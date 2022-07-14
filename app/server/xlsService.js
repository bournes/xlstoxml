const path = require('path')
const settingService = require("./settingService")
const { ipcMain } = require('electron')
const XLSX = require('xlsx');
const fs = require('fs');
// const Handlebars = require('handlebars');
const nunjucks = require('nunjucks')
nunjucks.configure({ autoescape: false });

let rounded = function(f) {
    if (f == 0) {
        return 0
    }
    //return parseInt(f);
    return Math.round(f);
}

let escape_xml = function(str) {
    str = str.replace(/>/g, "&gt;")
    str = str.replace(/</g, "&lt;")
    str = str.replace(/"/g, "&quot;")

    return str
}

let escape_lua = function(str) {
    str = str.replace(/&gt;/g, ">")
    str = str.replace(/&lt;/g, "<")
    str = str.replace(/\\t/g, "    ")
        // str = str.replace(/"(.*?)"/g, "“$1”")
    str = str.replace(/"(.*?)"/g, "\\\"$1\\\"")
    return str
}

let escape_csv = function(str) {
    str = str.replace(/&gt;/g, ">")
    str = str.replace(/&lt;/g, "<")

    let has_quote = false
    if (str.match(/\"|,/)) {
        has_quote = true
    }

    str = str.replace(/"/g, '""')
    if (has_quote) {
        return '"' + str + '"'
    }

    return str
}




let get_cell_v = function(cell) {
    if (cell == null) {
        return ""
    }
    return cell.v
}


let getNextAZ = function(az) {
    let azlist = az.split("")
    let zcharcode = "Z".charCodeAt(0)
    let carrier = 0

    for (let i = azlist.length - 1; i >= 0; i--) {
        let v = azlist[i].charCodeAt(0)
        if (v < zcharcode) {
            v++;
            azlist[i] = String.fromCharCode(v);
            carrier = 0
            break;
        } else {
            azlist[i] = 'A'
            carrier = 1
        }
    }
    if (carrier == 1) {
        azlist.unshift("A")
    }

    return azlist.join("")
}

//修正别名, 字段名重复的问题
// let fixAliasOfColumnsData = function(needColumnsData, columnsInfo) {

//     for (let info of needColumnsData) {
//         let realName = info.column
//         let k = info.column
//         if (columnsInfo[k] && columnsInfo[k].alias != "") {
//             realName = columnsInfo[k].alias

//             info['column'] = realName
//         }
//     }
//     return needColumnsData
// }

// let fixAliasOfRowsData = function(rowsData, columnsInfo) {
//     for (let row of rowsData) {
//         for (let k in row) {
//             let realName = k
//             if (columnsInfo[k] && columnsInfo[k].alias != "") {
//                 realName = columnsInfo[k].alias

//                 row[realName] = row[k]
//                 delete row[k]
//             }
//         }
//     }
//     return rowsData
// }

//解析xls, 获得表格内容和其他基本信息
let parse_xls = function(filePath, parseResult) {
    let workbook = XLSX.readFile(filePath);
    if (workbook == null) {
        return "can't read as xlsx file";
    }
    let first_sheet_name = workbook.SheetNames[0];

    let worksheet = workbook.Sheets[first_sheet_name];

    let range = worksheet["!ref"]
    let re = /\:([A-Z]+)(\d+)/;
    let found = range.match(re);
    let maxColumn = "A"
    let maxRow = 1
    if (found && found[1] != null && found[2] != null) {
        maxColumn = found[1]
        maxRow = found[2]
    } else {
        return "no data in the xlsx file";
    }
    parseResult['maxRow'] = maxRow;
    parseResult['maxColumn'] = maxColumn;

    if (maxRow < 5) {
        return "缺少字段定义";
    }


    //columns
    let startColumn = 'A'

    let columnTypeRow = 2
    let columnDescRow = 3
    let columnExportRow = 4
    let columnNameRow = 5
    let columnContentRow = 6
    let columns = []
    let columnsInfo = {}
    while (true) {
        //...
        let cellType = worksheet[startColumn + columnTypeRow.toString()]
        let cellDesc = worksheet[startColumn + columnDescRow.toString()]
        let cellExport = worksheet[startColumn + columnExportRow.toString()]
        let cellName = worksheet[startColumn + columnNameRow.toString()]
        if (cellName == null || cellDesc == null || cellExport == null) {
            break
        }
        let columnName = get_cell_v(cellName)
            // let alias = ""
            // if (columnsInfo[columnName]) {
            //     //我去, 有字段名重复,自动改成别名
            //     alias = columnName
            //     columnName = columnName + "_" + startColumn
            // }

        columns.push(columnName)

        columnsInfo[columnName] = {
            type: cellType == null ? "int" : get_cell_v(cellType),
            desc: get_cell_v(cellDesc),
            export: get_cell_v(cellExport),
            // alias: alias
        }
        if (startColumn == maxColumn) {
            break
        }
        startColumn = getNextAZ(startColumn)
    }
    parseResult['columns'] = columns;
    parseResult['columnsInfo'] = columnsInfo;

    //check columns duplicated name
    let checkColumnName = {}
    for (let j = 0; j < columns.length; j++) {
        let columnName = columns[j]
        if (columnName != "" && checkColumnName[columnName]) {
            return "字段名重复:  " + columnName;
        }
        checkColumnName[columnName] = 1;
    }



    //rows
    let rows = []
    let regRef = new RegExp('\$([\w\_]+)\$','g');

    for (let i = columnContentRow; i <= maxRow; i++) {
        startColumn = 'A'
        let rowData = {}
        let isEmptyRow = true
        for (let j = 0; j < columns.length; j++) {
            let cell = worksheet[startColumn + i.toString()]
            let columnName = columns[j]
            let columnInfo = columnsInfo[columnName]
            let v = get_cell_v(cell)
            if (columnInfo != null) {
                rowData[columnName] = v.toString().trim()
                if (v != "") {
                    isEmptyRow = false
                }
            }
            startColumn = getNextAZ(startColumn)
        }
        if (!isEmptyRow) {

            //有一些字段包含$xxxx$的字段， 用正则匹配给替换成最终的值
            for( let columnName in rowData) {
                let val = rowData[columnName]
                let regRef = new RegExp('$(.+?)$','g');
                let result
                let results = []
                while ( (result = regRef.exec(val)) != null ) {
                    results.push(result[1])
                }

                if (results && results.length > 0) {
                    for (let r of results) {
                        if (rowData[r] != null) {
                            val = val.replace("$" + r + "$", rowData[r])
                        }
                    }
                    rowData[columnName] = val
                }

            }

            rows.push(rowData)
        }

    }
    parseResult['rows'] = rows;

    

    

    //索引
    let indexString = get_cell_v(worksheet["A1"])
    indexString = indexString.replace(/\s/, "")
    let indexOfColumns = indexString.split(",")
    parseResult['indexOfColumns'] = indexOfColumns;
    for (let col of indexOfColumns) {
        if (columnsInfo[col] == null) {
            return "index of " + col + " is not exists";
        }
    }


    //索引类型
    let indexType = "int";
    if (indexOfColumns.length > 1) {
        indexType = "string";
    } else if (indexOfColumns.length == 1) {
        let column = indexOfColumns[0]
        if (columnsInfo[column].type == "string") {
            indexType = "string";
        }
    }
    parseResult['indexType'] = indexType;

    //生成索引数据
    let indexData = {}
    for (let i = 0; i < rows.length; i++) {
        let r = rows[i]
        let indexValues = []
        for (let col of indexOfColumns) {
			if (r[col] != "") {
				indexValues.push(r[col])
			}
			else {
				return "主键字段不能为空！字段名: " + col
			}	
        }
        let key = indexValues.join("_")
        if (indexData[key]) {
            return "主键重复了:" + key
        }
        indexData[key] = i
    }
    parseResult['indexData'] = indexData;


    // console.log(parseResult)



    return "ok"
}


let export_to_lua = function(parseResult, needColumns, needColumnsData, filename, setting) {
    let source = fs.readFileSync(path.join(__dirname, '../tmpl/lua.tmpl'), 'utf8')


    let rowsData = []

    for (let row of parseResult.rows) {
        let r = {}
        for (let col of needColumns) {
            let v = row[col]
            if (parseResult.columnsInfo[col].type == "int") {
                v = rounded(v)
            } else if (parseResult.columnsInfo[col].type == "string") {
                v = '"' + escape_lua(v) + '"'
            }
            r[col] = v
        }
        rowsData.push(r)
    }
    // needColumnsData = fixAliasOfColumnsData(needColumnsData, parseResult.columnsInfo)
    // rowsData = fixAliasOfRowsData(rowsData, parseResult.columnsInfo)
    var data = {
        record_name: "record_" + filename,
        class_name: filename,
        needColumnsData: needColumnsData,
        rowsData: rowsData,
        indexOfColumns: parseResult.indexOfColumns,
        indexData: parseResult.indexData,
        indexType: parseResult.indexType

    };
    var result = nunjucks.renderString(source, data);
    // console.log(result)
    let output = path.join(setting.dir, filename + ".lua")
    fs.writeFileSync(output, result)
    return output

}

let export_to_xml = function(parseResult, needColumns, needColumnsData, filename, setting) {

    let source = fs.readFileSync(path.join(__dirname, '../tmpl/xml.tmpl'), 'utf8')


    let rowsData = []

    for (let row of parseResult.rows) {
        let r = {}
        for (let col of needColumns) {
            let v = row[col]
            if (parseResult.columnsInfo[col].type == "int") {
                v = rounded(v)
            } else if (parseResult.columnsInfo[col].type == "string") {
                v = escape_xml(v)
            }
            r[col] = v
        }
        rowsData.push(r)
    }
    // needColumnsData = fixAliasOfColumnsData(needColumnsData, parseResult.columnsInfo)
    // rowsData = fixAliasOfRowsData(rowsData, parseResult.columnsInfo)
    var data = {
        needColumnsData: needColumnsData,
        rowsData: rowsData
    };
    var result = nunjucks.renderString(source, data);
    // console.log(result)
    let output = path.join(setting.dir, filename + ".xml")
    fs.writeFileSync(output, result)
    return output
}

let export_to_csv = function(parseResult, needColumns, needColumnsData, filename, setting) {

    let source = fs.readFileSync(path.join(__dirname, '../tmpl/csv.tmpl'), 'utf8')


    let rowsData = []

    for (let row of parseResult.rows) {
        let r = []
        for (let col of needColumns) {
            let v = row[col]
            r.push(escape_csv(v))
        }
        rowsData.push(r)
    }
    // needColumnsData = fixAliasOfColumnsData(needColumnsData, parseResult.columnsInfo)

    var data = {
        needColumnsData: needColumnsData,
        rowsData: rowsData
    };
    var result = nunjucks.renderString(source, data);
    // console.log(result)
    let output = path.join(setting.dir, filename + ".csv")
    fs.writeFileSync(output, result)
    return output
}

let export_xls = function(event, filePath, jobId) {
    let settings = require("./settingService").getData()

    let found = filePath.match(/.*?([\w\.]+)\.xlsx$/)
    if (found == null) {
        event.sender.send('s2c_export_xls', jobId, "error", "not a .xlsx file");
        return
    }

    for (let setting of settings) {
        if (setting.need) {
            if (!fs.existsSync(setting.dir)) {
                event.sender.send('s2c_export_xls', jobId, "error", "输出目录不存在" + setting.dir);
                return
            }

        }
    }

    let parseResult = {}
    let ret = parse_xls(filePath, parseResult)
    if (ret != "ok") {
        console.log("ret=" + ret)
        console.log(parseResult)
        event.sender.send('s2c_export_xls', jobId, "error", ret);
        return
    }

    //export now 

    // console.log(parseResult)
    let filename = found[1]
    let outputs = []
    for (let setting of settings) {
        if (setting.need) {
            //过滤出需要输出的columns
            let needColumns = []


            for (let col of parseResult.columns) {
                let needExportStr = parseResult.columnsInfo[col].export
                var re = new RegExp(setting.reg, "i");
                if (needExportStr.match(re)) {
                    needColumns.push(col)
                }
            }


            let needColumnsData = []
            for (let col of needColumns) {
                needColumnsData.push({ column: col, desc: parseResult.columnsInfo[col].desc, type: parseResult.columnsInfo[col].type })
            }
            if (needColumnsData.length > 0) {
                if (setting.text == "lua") {
                    let output = export_to_lua(parseResult, needColumns, needColumnsData, filename, setting)
                    outputs.push(output)
                } else if (setting.text == "xml") {
                    let output = export_to_xml(parseResult, needColumns, needColumnsData, filename, setting)
                    outputs.push(output)
                } else if (setting.text == "csv") {
                    let output = export_to_csv(parseResult, needColumns, needColumnsData, filename, setting)
                    outputs.push(output)
                }
            }

        }
    }



    event.sender.send('s2c_export_xls', jobId, "ok", "", outputs);
}

let start = function() {
    ipcMain.on('c2s_export_xls', (event, filePath, jobId) => {
        //,....
        // let settings = settingService.getData()


        export_xls(event, filePath, jobId);
    })

}






module.exports = {
    start: start

};