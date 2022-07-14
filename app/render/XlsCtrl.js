const { ipcRenderer } = require('electron')



angular.module('myapp').controller("XlsCtrl", function($scope) {




    $scope.openSetting = function() {
        ipcRenderer.send('c2s_open_setting');
    }




    $scope.initDropEvent = function() {

        const holder = document.getElementById('holder')
        holder.ondragover = () => {
            return false;
        }
        holder.ondragleave = holder.ondragend = () => {
            return false;
        }
        holder.ondrop = (e) => {
            e.preventDefault();
            // for (let f of e.dataTransfer.files) {
            //     console.log('File(s) you dragged here: ', f.path)
            // }
            $scope.jobs = [];
            if (e.dataTransfer.files.length > 0) {
                $scope.addJobs(e.dataTransfer.files);
            }

            return false;
        }


    }

    $scope.addJobs = function(files) {
        $scope.jobs = [];
        for (let f of files) {
            let job = {
                filename: f.path,
                path: f.path,
                status: "wait",
                jobId: $scope.startJobId,
                outputs: [],
                error: "",
                // elementId: "job_" + $scope.startJobId
            };
            $scope.startJobId = $scope.startJobId + 1;
            $scope.jobs.push(job);

        }
        //need to force 
        $scope.$apply();

        $scope.startRunJobs();
    };

    $scope.startRunJobs = function() {

        $scope.runningJobIndex = 0;
        $scope.runNextJob();


    }

    $scope.addEventListeners = function() {
        ipcRenderer.on('s2c_export_xls', (event, jobId, ret, error, outputs) => {

            let job = $scope.getJobByJobId(jobId);
            if (job) {
                job.status = ret;
                job.error = error;
                job.outputs = outputs;
                // console.log({ event, jobId, ret, error, outputs })
                //need to force 
                $scope.$apply();
                // window.scrollTo(0, angular.element("#" + job.elementId).offsetTop - 100)
                if (job.status == "ok") {

                    $scope.runNextJob();
                }
            } else {
                $scope.runNextJob();
            }





        });
    }


    $scope.getJobByJobId = function(jobId) {
        for (let j of $scope.jobs) {
            if (j.jobId == jobId) {
                return j;
            }
        }
        return null;

    }
    $scope.runNextJob = function() {

        if ($scope.runningJobIndex < $scope.jobs.length) {
            let job = $scope.jobs[$scope.runningJobIndex];
            $scope.status = $scope.runningJobIndex + "/" + $scope.jobs.length + ", 导出当中...."

            setTimeout(function() {

                ipcRenderer.send('c2s_export_xls', job.path, job.jobId);
                $scope.runningJobIndex++;
            }, 20);

        } else {
            //finished all
            $scope.status = $scope.runningJobIndex + "/" + $scope.jobs.length + ", 完成!"
        }

    }
    $scope.status = "请把要导出的xlsx文件拖入下面的浅紫色区域"
    $scope.startJobId = 1;
    $scope.runningJobIndex = 0;
    $scope.jobs = [];
    $scope.initDropEvent();
    $scope.addEventListeners();
});