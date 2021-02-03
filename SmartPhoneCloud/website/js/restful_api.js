/**
 * Copyright 2018 黎慧剑
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * 智能手机群控后台学习版 - Restful Api公共处理js
 * @file (restful_api.js)
 * @author (黎慧剑)
 * @version (0.1.0)
 */

;
$.debug = true;

/**
 * 自定义休眠时长函数
 * @param {int} numberMillis - 休眠时长，单位为毫秒
 */
function sleep(numberMillis) {
    var now = new Date();
    var exitTime = now.getTime() + numberMillis;
    while (true) {
        now = new Date();
        if (now.getTime() > exitTime)
            return;
    }
};

;
(function ($) {
    /**
     * 定义插件名称，避免不同插件之间相互干扰
     * @class restful_api
     */
    $.restful_api = new Object();

    /**
     * 在告警框提示debug信息($.debug为true的情况下才执行)
     * @param {string} str - 要提示的信息
     */
    function debug(str) {
        if ($.debug === true) {
            alert('debug: ' + str);
        }
    };


    /**
     * 生成接口ID
     */
    $.restful_api.get_interface_id = function() {
        return Math.uuid();
    };



    /**
     * 执行Ajax调用
     * @param {string} url - 要调用的接口url
     * @param {json} json_data - 要上传的json数据
     * @param {json} call_para - 调用参数，支持参数如下
     *   type {string} - http协议的调用方法: 'get', 'post', 默认为'post'
     *   content_type {string} - 内容格式, 默认为'application/json'
     *   headers {json} - Http协议头内容, 默认为 {}
     *   timeout {int} - 超时时间，单位为毫秒, 默认为10000
     *   async {bool} - 是否异步执行, 默认为 false
     *   tips {string} - 送入返回处理函数的提示信息, 默认为 ''
     *   success_not_alert {bool} - 成功交易不提示, 默认为false
     *   ajax_feedback {function} - 调用成功执行的反馈处理函数, 默认为 ajax_feedback_common
     *     如果自定义函数, 函数定义如下:
     *     function ajax_feedback_common(result, success_fun, tips){...}
     *     注意：函数送入的值分别为 结果json对象, 结果成功的执行函数(参考success_fun), 提示文本信息
     *   success_fun {function} - 结果成功的执行函数, 在调用ajax_feedback时通过参数送入
     *     如果自定义函数，函数定义如下：
     *     fun(result) {...; return [bool, msg];}
     *   ajax_error {function} - 调用异常的反馈处理函数, 默认为 ajax_error_common
     *     如果自定义函数, 函数定义如下：
     *      function ajax_error_common(xhr, status, error, tips){...; return;}
     */
    $.restful_api.ajax_call = function (url, json_data, call_para) {
        // 默认参数
        if (call_para === undefined) {
            call_para = {};
        }
        if (call_para.type === undefined) {
            call_para.type = 'post';
        }
        if (call_para.content_type === undefined) {
            call_para.content_type = 'application/json';
        }
        if (call_para.headers === undefined) {
            call_para.headers = {};
        }
        if (call_para.timeout === undefined) {
            call_para.timeout = 10000;
        }
        if (call_para.async === undefined) {
            call_para.async = false;
        }
        // 调用后的回调函数参数
        if (call_para.tips === undefined) {
            call_para.tips = '';
        }
        if (call_para.success_not_alert === undefined) {
            call_para.success_not_alert = false;
        }

        if (call_para.ajax_feedback === undefined) {
            call_para.ajax_feedback = ajax_feedback_common;
        }
        if (call_para.success_fun === undefined) {
            call_para.success_fun = function (result) {
                return [true, 'success'];
            };
        }
        if (call_para.ajax_error === undefined) {
            call_para.ajax_error = ajax_error_common;
        }

        // 执行Ajax
        $.ajax({
            url: url,
            type: call_para.type,
            contentType: call_para.content_type,
            headers: call_para.headers,
            data: JSON.stringify(json_data),
            timeout: call_para.timeout,
            async: call_para.async, // 异步处理
            success: function (result) {
                // 通过参数传入的函数执行
                call_para.ajax_feedback(result, call_para.success_fun, call_para.tips, call_para.success_not_alert);
            },
            error: function (xhr, status, error) {
                call_para.ajax_error(xhr, status, error, call_para.tips);
            }
        });
    };

    /**
     * 通用的Ajax调用返回处理函数
     * @param {object} result - 返回的json对象
     * @param {function} success_fun - 成功的执行函数, 格式为:
     *      fun(result) {...; return [bool, msg]; }
     * @param {str} tips='' - 交易提示
     * @param {bool} success_not_alert=false - 成功交易不提示
     */
    function ajax_feedback_common(result, success_fun, tips, success_not_alert) {
        // 默认值
        if (tips === undefined) {
            tips = '';
        }
        if (success_not_alert === undefined) {
            success_not_alert = false;
        }


        var retObj = result;
        if (retObj.status == "00000") {
            // 返回成功
            deal_info = success_fun(retObj);
            if (deal_info === undefined || (deal_info != null && deal_info[0])) {
                // 处理成功
                if (!success_not_alert) {
                    // 设置自动隐藏
                    $.ui_tools.alert(
                        tips + '处理成功！', '提示', 'info', true
                    );
                }
            } else {
                // 处理失败
                $.ui_tools.alert(
                    tips + '处理失败: ' + deal_info[1], '告警信息', 'alert'
                );
            }
        } else {
            // 返回失败
            $.ui_tools.alert(
                tips + '返回失败[' + retObj.status + ']: ' + retObj.msg,
                '告警信息', 'alert'
            );
        }
    };

    /**
     * 通用的Ajax调用错误处理函数
     * @param {*} xhr
     * @param {*} status
     * @param {*} error
     * @param {str} tips='' - 交易提示
     */
    function ajax_error_common(xhr, status, error, tips) {
        // 默认值
        if (tips === undefined) {
            tips = '';
        }

        // 直接调用提示就好
        $.ui_tools.alert(
            tips + '处理异常: ' + error,
            '告警信息', 'alert'
        );
    };

})(jQuery);
