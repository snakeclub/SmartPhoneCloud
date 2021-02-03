/**
 * Copyright 2018 黎慧剑
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * 智能手机群控后台学习版 - 设备管理
 * @file (devices.js)
 * @author (黎慧剑)
 * @version (0.1.0)
 */

;
(function ($) {
    /**
     * 定义插件名称，避免不同插件之间相互干扰
     * @class devices
     */
    $.devices = new Object();

    /**
     * 连接服务器端的socketio对象
     */
    $.devices.socketio = null;

    /**
     * 设备信息清单
     */
    $.devices.devices_info = {};

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
     * 设备清单表格配置的参数, 请参考 bootstrap-table 参数
     */
    $.devices.devices_table_json = {
        showHeader: true, // 显示标题
        showColumns: false, // 是否显示所有的列（选择显示的列）
        showToggle: false, // 是否显示详细视图和列表视图的切换按钮
        clickToSelect: false, // 是否启用点击选中行
        onDblClickRow: function (row, $element) {
            // 填入弹出框的值
            $('#bind_nick_name_device_name').val(row.device_name);
            $('#bind_nick_name_nickname').val(row.nick_name);

            // 展示弹出框
            $.ui_tools.show_modal('device_bind_nick_name');
        },
        onCheckAll: function (){
            // 全部选中
            for(var device_name in $.devices.devices_info){
                var info = $.devices.devices_info[device_name];
                if(!info.is_control){
                    var list_check = $('#list_check_'+device_name);
                    if(!list_check.is(':checked')){
                        $('#list_check_'+device_name).prop("checked", true);
                    }
                }
            }
        },
        onUncheckAll: function (){
            // 取消选中
            for(var device_name in $.devices.devices_info){
                var info = $.devices.devices_info[device_name];
                if(!info.is_control){
                    var list_check = $('#list_check_'+device_name);
                    if(list_check.is(':checked')){
                        $('#list_check_'+device_name).prop("checked", false);
                    }
                }
            }
        },
        onCheck: function (row) {
            // 选中一行的操作
            var info = $.devices.devices_info[row.device_name];
            if(!info.is_control){
                // 勾选列表
                var list_check = $('#list_check_'+row.device_name);
                if(!list_check.is(':checked')){
                    $('#list_check_'+row.device_name).prop("checked", true);
                }
            }
        },
        onUncheck: function (row) {
            // 取消选中一行的操作
            var info = $.devices.devices_info[row.device_name];
            if(!info.is_control){
                // 取消勾选列表
                var list_check = $('#list_check_'+row.device_name);
                if(list_check.is(':checked')){
                    $('#list_check_'+row.device_name).prop("checked", false);
                }
            }
        },
        ignoreClickToSelectOn: function (e) { // 忽略点击选中行的元素，比如行里面的checkbox
            return ['BUTTON', 'I'].indexOf(e.tagName) > -1;
        },
        sortable: true, // 是否启用排序
        sortOrder: "asc", // 排序方式
        cache: false, // 是否使用缓存，默认为true，所以一般情况下需要设置一下这个属性（*）
        classes: 'table table-bordered table-hover table-striped', // 表格样式
        uniqueId: "device_name", // 每一行的唯一标识，一般为主键列
        data: [], // 数据数组, 数组每个值为行对象字典, [{'field_name': 'field_value', ...}, ...]
        columns: [{ // 标题头内容
            field: 'selected', // 复选框
            checkbox: true,
            valign: 'middle',
            align: 'center',
            width: 10,
        }, {
            field: 'nick_name',
            title: '别名',
            sortable: true
        },{
            field: 'device_name',
            title: '设备名',
            visible: true,
            sortable: true
        }],
    };

    /**
     * 列表显示的屏幕html模板
     */
    $.devices.list_screen_html = '<div class="p-2 mr-2 {$color$}" style="text-align: center;">' +
        '<canvas id="list_canvas_{$id$}" style="background-color:dimgrey; width: {$width$}px; height: {$height$}px;" ' +
        'onclick="$.devices.switch_device_show(\'{$id$}\', true);"></canvas>' +
        '<div class="form-group form-check">' +
            '<input type="checkbox" class="form-check-input" id="list_check_{$id$}">' +
            '<label class="form-check-label" for="list_check_{$id$}">{$nick_name$}</label>' +
        '</div>' +
    '</div>';

    /**
     * 初始化设备的界面
     */
    $.devices.init_ui = function(){
        // 初始化设备清单表格
        $('#devices_table').bootstrapTable($.devices.devices_table_json);

        // 控制手机的样式
        $.devices.change_control_size(
            $.sysconfig.config.control_width, $.sysconfig.config.control_height
        );

        // 控制端隐藏按钮绑定显示处理函数
        $('#control_hide_button').click(function(){
            var control_device_name = $('#control_device_name').html();
            if(control_device_name != ''){
                $.devices.switch_device_show(control_device_name, false);
            }
        });

        // 绑定操作屏幕的动作
        $('#control_canvas_id').parent().bind("mousedown",$.devices.onscreen_mousedown);
    };

    /**
     * 添加或更新设备清单
     * @param {string} device_name - 设备名
     * @param {json} info - 设备信息字典
     */
    $.devices.add_devices_table = function(device_name, info){
        // 添加或修改全局变量，应通过遍历更新的方式
        if($.devices.devices_info.hasOwnProperty(device_name)){
            for(var prop_name in info){
                $.devices.devices_info[device_name][prop_name] = info[prop_name];
            }
        }
        else{
            // 新设备，更新
            $.devices.devices_info[device_name] = info;
        }

        // 添加或修改设备清单
        var devices_table = $('#devices_table');
        var row = devices_table.bootstrapTable('getRowByUniqueId', device_name);
        if (row === undefined || row === null) {
            // 新增
            $('#devices_table').bootstrapTable(
                'append', [{
                    'device_name': device_name, 'nick_name': info.nick_name
                }]
            );
        }else{
            // 更新
            $('#devices_table').bootstrapTable(
                'updateByUniqueId', {
                    'device_name': device_name, row: {'nick_name': info.nick_name}
                }
            );
        }
    };

    /**
     * 从设备清单删除
     * @param {string} device_name - 设备名
     */
    $.devices.remove_devices_table = function(device_name){
        // 从设备清单删除
        $('#devices_table').bootstrapTable(
            'removeByUniqueId', device_name
        );

        // 从全局变量删除
        delete $.devices.devices_info[device_name];
    };

    /**
     * 修改控制手机大小
     * @param {int} width - 宽度
     * @param {int} height - 高度
     */
    $.devices.change_control_size = function(width, height){
        var real_width = width + 10;
        $('.android-phone').css('width', real_width + 'px');
        $('.android-phone .phone-screen').css('height', height + 'px');
    };

    /**
     * 改变控制手机信息
     * @param {string} device_name - 设备号
     * @param {string} nick_name - 显示名
     * @param {string} status - 状态，'ready'/'ready-no-screen'/'init'/'error'
     */
    $.devices.change_control_info = function(device_name, nick_name, status){
        if (nick_name === undefined || nick_name == ''){
            nick_name = device_name;
        }
        $('#control_device_nick_name').html(nick_name);
        $('#control_device_name').html(device_name);
        var status_obj = $('.android-phone .phone-head-bg .bi-circle-fill');
        status_obj.removeClass('text-success text-danger text-warning');
        if (status == 'ready' || status == 'ready-no-screen'){
            status_obj.addClass('text-success');
        }else if (status == 'init'){
            status_obj.addClass('text-warning');
        }else{
            status_obj.addClass('text-danger');
        }
    };

    /**
     * 删除控制台信息
     */
    $.devices.remove_control_info = function(){
        $.devices.change_control_info('', '', 'error');
    };

    /**
     * 添加一个小屏同步显示界面
     * @param {string} device_name - 设备号
     * @param {string} nick_name - 显示名
     * @param {int} width - 宽度
     * @param {int} height - 高度
     * @param {string} status - 状态，'ready'/'ready-no-screen'/'init'/'error'
     */
    $.devices.add_list_screen = function(device_name, nick_name, width, height, status){
        if (nick_name === undefined || nick_name == ''){
            nick_name = device_name;
        }

        var color = 'text-danger';
        if (status == 'ready' || status == 'ready-no-screen'){
            color = 'text-success';
        }else if (status == 'init'){
            color = 'text-warning';
        }

        var html = $.devices.list_screen_html.replaceAll(
            "{$id$}", device_name
        ).replaceAll(
            "{$nick_name$}", nick_name
        ).replaceAll(
            "{$width$}", width.toString()
        ).replaceAll(
            "{$height$}", height.toString()
        ).replaceAll(
            "{$color$}", color
        );

        $('#list_screen_layout').append(html);

        // 判断是否勾选
        var selsetions = $('#devices_table').bootstrapTable('getSelections');
        for (var i = 1; i < selsetions.length; i++) {
            if(selsetions[i].device_name == device_name){
                // 选中了，需要勾选
                $('#list_check_'+device_name).prop("checked", true);
                break;
            }
        }

        // 绑定选中事件
        $('#list_check_'+device_name).change(function() {
            // alert($(this).is(':checked'));
            var device_name = $(this).attr('id').replace('list_check_', '');
            if($(this).is(':checked')){
                // 选中
                $('#devices_table').bootstrapTable(
                    'checkBy', {field:'device_name', values:[device_name]}
                );
            }
            else{
                // 取消选中
                $('#devices_table').bootstrapTable(
                    'uncheckBy', {field:'device_name', values:[device_name]}
                );
            }
        });
    };

    /**
     * 修改小屏同步显示界面大小
     * @param {string} device_name - 设备号
     * @param {int} width - 宽度
     * @param {int} height - 高度
     * @param {string} status - 状态，'ready'/'ready-no-screen'/'init'/'error'
     */
    $.devices.change_list_screen_info = function(device_name, width, height, status){
        var canvas = $('#list_canvas_' + device_name);
        canvas.css('width', width + 'px');
        canvas.css('height', height + 'px');

        // 设置字体颜色
        var color = 'text-danger';
        if (status == 'ready' || status == 'ready-no-screen'){
            color = 'text-success';
        }else if (status == 'init'){
            color = 'text-warning';
        }
        var status_obj = canvas.parent();
        status_obj.removeClass('text-success text-danger text-warning');
        status_obj.addClass(color);
    };

    /**
     * 移除小屏同步显界面
     * @param {string} device_name - 设备名
     */
    $.devices.remove_list_screen = function(device_name){
        $('#list_canvas_'+device_name).parent().remove();
    };

    /**
     * 连接视频源
     *
     * @param {string} device_name - 设备名
     * @param {string} canvas_id - 画布id
     */
    $.devices.connect_minicap = function(device_name, canvas_id){
        // 设备信息
        var info = $.devices.devices_info[device_name];

        // 视频处理
        var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

        var canvas = document.getElementById(canvas_id);
        var g = canvas.getContext('2d');

        var ratio = $.ui_tools.getPixelRatio(g);  // 画布精度比例

        // 设置画布大小
        $(canvas).css('width', info.show_size[0]+'px');
        $(canvas).css('height', info.show_size[1]+'px');
        canvas.width = info.canvas_size[0]*ratio;
        canvas.height = info.canvas_size[1]*ratio;

        $.devices.devices_info[device_name].ws = new WebSocket(
            'ws://' + $.sysconfig.config.minicap_host + ':' + $.sysconfig.config.minicap_port
            + '/para?port=' + info.port + '&id=' + escape(device_name),
            'minicap'
        );
        var ws = $.devices.devices_info[device_name].ws;
        ws.binaryType = 'blob';

        ws.onclose = function() {
            console.log('onclose', arguments);
        };

        ws.onerror = function() {
            // 失败隔5秒自动重连
            var info = $.devices.devices_info[device_name];
            if (info.status != 'ready'){
                // 不是就绪状态，不重连
                return;
            }

            console.log('onerror: auto reconnect - ' + device_name);
            setTimeout(function () {
                $.devices.disconnect_minicap(device_name, canvas_id);
                $.devices.connect_minicap(device_name, canvas_id);
            }, 5000);
        };

        ws.onmessage = function(message) {
            var blob = new Blob([message.data], {type: 'image/jpeg'});
            var URL = window.URL || window.webkitURL;
            var img = new Image();
            img.onload = function() {
                console.log(img.width, img.height);
                // 按实际精度展示
                g.drawImage(img, 0, 0, img.width*ratio, img.height*ratio);
                img.onload = null;
                img.src = BLANK_IMG;
                img = null;
                u = null;
                blob = null;
            }
            var u = URL.createObjectURL(blob);
            img.src = u;
        };

        ws.onopen = function() {
            var send_msg = info.canvas_size[0] + 'x' + info.canvas_size[1] + '/0';
            console.log('onopen send: ' + send_msg);
            ws.send(send_msg);
        };
    };

    /**
     * 取消视频连接
     * @param {string} device_name - 设备名
     * @param {string} canvas_id - 画布id
     */
    $.devices.disconnect_minicap = function(device_name, canvas_id){
        // 关闭连接
        var info = $.devices.devices_info[device_name];
        if(info.hasOwnProperty('ws') && info.ws != null){
            info.ws.close();
            info.ws = null;

            // 将画布内容清空
            var canvas = document.getElementById(canvas_id);
            var g = canvas.getContext('2d');
            if(g.hasOwnProperty('height')){
                g.height = g.height;
            }
            else{
                try{
                    g.clearRect(0,0, info.show_size[0], info.show_size[1]);
                }catch (e) {
                    // 进行异常提示
                    $.ui_tools.alert(
                        '$.devices.disconnect_minicap exception: ' + e.toString(),
                        '告警信息', 'alert'
                    );
                }
            }
        }
    };


    /**
     * 设备清单更新部分代码
     *
     */


    /**
     * 启动设备同步任务
     */
    $.devices.start_devices_sync = function(){
        // 连接socketio服务器
        $.devices.socketio = io('http://' + $.sysconfig.config.socketio_host + ':' + $.sysconfig.config.socketio_port);

        $.devices.socketio.on('connect', function() {
            console.log("<div>connected: " +$.devices.socketio.connected+ "<br>client: client connect!</div>");
        });

        $.devices.socketio.on('disconnect', function() {
            console.log("<div>client: client disconnect!</div>");
        });

        // 绑定返回全量设备清单的处理函数
        $.devices.socketio.on('full_devices', function (data) {
            // alert('full_devices: ' + JSON.stringify(data));
            // 清空所有设备的显示
            for(var device_name in $.devices.devices_info){
                // 删除屏幕同步对象
                var info = $.devices.devices_info[device_name];
                if (info.is_control){
                    $.devices.remove_from_control();
                }else{
                    $.devices.remove_from_list(device_name);
                }

                // 删除清单
                $.devices.remove_devices_table(device_name);
            }

            // 删除清单
            $.devices.devices_info = {};

            // 获取到完整设备清单, 遍历处理
            for(var device_name in data){
                var info = data[device_name];
                // 添加清单
                $.devices.add_devices_table(device_name, info);

                // 添加屏幕同步对象
                if(info.is_control){
                    // 控制机
                    $.devices.add_to_control(device_name);
                }else{
                    // 显示列表
                    $.devices.add_to_list(device_name);
                }
            }
        });

        // 绑定添加设备的处理函数
        $.devices.socketio.on('add_device', function(data){
            // alert('add_device: ' + JSON.stringify(data));
            for(var device_name in data){
                var info = data[device_name];

                // 添加到列表
                $.devices.add_devices_table(device_name, info);

                // 添加到屏幕同步
                if(info.is_control){
                    // 控制机
                    $.devices.add_to_control(device_name);
                }else{
                    // 显示列表
                    $.devices.add_to_list(device_name);
                }
            }
        });

        // 绑定删除设备的处理函数
        $.devices.socketio.on('remove_device', function(data){
            // alert('remove_device: ' + JSON.stringify(data));
            var device_name = data.device;

            // 删除屏幕同步对象
            var info = $.devices.devices_info[device_name];
            if(info.is_control){
                // 控制机
                $.devices.remove_from_control();
            }else{
                // 显示列表
                $.devices.remove_from_list(device_name);
            }

            // 删除清单
            $.devices.remove_devices_table(device_name);
        });

        // 绑定修改设备昵称的处理函数
        $.devices.socketio.on('change_device_nick_name', function(data){
            // alert('add_device: ' + JSON.stringify(data));
            for(var device_name in data){
                // 修改设备昵称
                $.devices.devices_info[device_name]['nick_name'] = data[device_name].nick_name;
                var info = $.devices.devices_info[device_name];

                // 修改清单上的显示名称
                $('#devices_table').bootstrapTable(
                    'updateByUniqueId', {
                        id: device_name, row: {'nick_name': info.nick_name}
                    }
                );

                // 修改显示的内容
                if(info.is_control){
                    // 控制机
                    $('#control_device_nick_name').html(info.nick_name);
                }else{
                    // 显示列表
                    $('label[for="list_check_'+device_name+'"]').html(info.nick_name);
                }
            }
        });
    };

    /**
     * 切换设备控制台和列表之间的显示
     * @param {string} device_name - 要切换的设备
     * @param {bool} is_control - 是否控制机
     */
    $.devices.switch_device_show = function(device_name, is_control){
        var info = $.devices.devices_info[device_name];
        if(info.is_control == is_control){
            // 没有改变显示位置，不处理
            return;
        }

        if(info.status == 'init'){
            // 正在初始化，不进行处理
            $.ui_tools.alert(
                '设备['+info.nick_name+']正在初始化, 请重新进行处理！',
                '告警信息', 'alert'
            );
            return;
        }

        // 将控制台当前设备放到列表中
        var control_device_name = $('#control_device_name').html();
        if (control_device_name != ''){
            // 移除控制台设备显示
            $.devices.remove_from_control();

            // 向列表中增加设备, 先显示出来
            var info = $.devices.devices_info[control_device_name];
            if ($('#list_canvas_' + control_device_name).length == 0){
                // 元素不存在的时候才添加
                $.devices.add_list_screen(
                    control_device_name, info.nick_name, $.sysconfig.config.list_width, $.sysconfig.config.list_height, 'init'
                );
            }

            // 向服务器端发送切换请求
            $.devices.socketio.emit(
                'switch_device_show', {
                    'device_name': control_device_name,
                    'is_control': false
                }
            );
        }

        if(is_control){
            // 切换新设备至控制台, 移除设备列表
            $.devices.remove_from_list(device_name);

            // 先将设备添加到控制台
            var info = $.devices.devices_info[device_name];
            $.devices.change_control_info(device_name, info.nick_name, 'init');

            // 向服务器端发送切换请求
            $.devices.socketio.emit(
                'switch_device_show', {
                    'device_name': device_name,
                    'is_control': true
                }
            );
        }
    };

    /**
     * 添加设备到控制窗口
     * @param {string} device_name - 设备名
     */
    $.devices.add_to_control = function(device_name){
        // 先移除当前控制窗口的设备
        var control_device_name = $('#control_device_name').html();
        if (control_device_name != '' && control_device_name != device_name){
            // 当前控制不是自己
            $.devices.remove_from_control();
        }

        // 添加设备到控制窗口
        var info = $.devices.devices_info[device_name];
        // 修改状态
        $.devices.change_control_info(device_name, info.nick_name, info.status);

        // 如果连接上，需要接入屏幕同步
        if(info.status == 'ready'){
            // 正常连接上，设置屏幕大小
            $.devices.change_control_size(info.show_size[0], info.show_size[1]);

            // 连接视频源
            $.devices.connect_minicap(device_name, 'control_canvas_id');

            // 绑定位置显示的鼠标动作
            $.devices.set_touch_info(device_name);
            $(document.body).bind("mousemove",$.devices.onscreen_mousemove_pos_show);
        }
        else{
            // 关闭视频源
            $.devices.disconnect_minicap(device_name, 'control_canvas_id');

            // 解除位置显示的鼠标动作
            $(document.body).unbind("mousemove",$.devices.onscreen_mousemove_pos_show);
        }
    };

    /**
     * 移除控制台的当前设备
     */
    $.devices.remove_from_control = function(){
        var device_name = $('#control_device_name').html();
        if (device_name == ''){
            // 没有设备
            return;
        }

        // 关闭连接
        $.devices.disconnect_minicap(device_name, 'control_canvas_id');

        // 从控制台删除设备
        $.devices.remove_control_info();
    };

    /**
     * 添加设备到列表中
     * @param {string} device_name - 设备名
     */
    $.devices.add_to_list = function(device_name){
        // 添加设备到列表
        var info = $.devices.devices_info[device_name];
        if ($('#list_canvas_' + device_name).length == 0){
            // 元素不存在的时候才添加
            $.devices.add_list_screen(
                device_name, info.nick_name, $.sysconfig.config.list_width, $.sysconfig.config.list_height, info.status
            );
        }

        // 如果连接上，需要接入屏幕同步
        if(info.status == 'ready'){
            // 正常连接上，设置屏幕大小
            $.devices.change_list_screen_info(device_name, info.show_size[0], info.show_size[1], info.status);

            // 连接视频源
            if(!info.hasOwnProperty('ws') || info.ws === null){
                // 避免重复连接的问题
                $.devices.connect_minicap(device_name, 'list_canvas_' + device_name);
            }
        }
        else{
            // 关闭视频源
            $.devices.disconnect_minicap(device_name, 'list_canvas_' + device_name);

            // 调整信息
            $.devices.change_list_screen_info(
                device_name, $.sysconfig.config.list_width, $.sysconfig.config.list_height, info.status
            );
        }
    };

    /**
     * 从列表中移除设备
     * @param {string} device_name  - 设备名
     */
    $.devices.remove_from_list = function(device_name){
        // 关闭连接
        $.devices.disconnect_minicap(device_name, 'list_canvas_' + device_name);

        // 从列表中删除
        $.devices.remove_list_screen(device_name);
    };


    /**
     * 以下为鼠标在控制台画布上的操作
     */

    $.devices.touch_down = false;
    $.devices.touch_last_pos = null;
    $.devices.touch_last_time = null;
    $.devices.touch_info = {};

    /**
     * 设置控制机的触屏信息
     *
     * @param {string} device_name - 要设置的设备
     */
    $.devices.set_touch_info = function(device_name){
        var info = $.devices.devices_info[device_name];
        // 登记信息
        $.devices.touch_info['device_name'] = device_name;
        $.devices.touch_info['show_size'] = info.show_size;
        // 计算x，y的换算比例
        $.devices.touch_info['scale_x'] = info.real_size[0] / info.show_size[0];
        $.devices.touch_info['scale_y'] = info.real_size[1] / info.show_size[1];
    };

    /**
     * 获取选中要操作的设备
     *
     * @returns {Array} - 设备名清单
     */
    $.devices.get_selected_devices = function(){
        var selected_devices = [];
        var selected_data = $('#devices_table').bootstrapTable('getSelections');
        for (var i = 0; i < selected_data.length; i++) {
            selected_devices.push(selected_data[i].device_name);
        }

        // 处理控制机
        var device_name = $('#control_device_name').html();
        if (device_name != '' && selected_devices.indexOf(device_name) < 0){
            // 把自己加到数组中
            selected_devices.push(device_name);
        }
        return selected_devices;
    };

    /**
     * 执行控制命令
     * @param {Array} devices - 要执行命令的设备清单
     * @param {string} type - 操作类型, minitouch | adb
     * @param {json} para - 操作参数
     */
    $.devices.emit_control = function(devices, type, para){
        $.devices.socketio.emit(
            'device_control', {
                'devices': devices,
                'type': type,
                'para': para
            }
        );
    };

    /**
     * 在屏幕上鼠标按下的事件
     */
    $.devices.onscreen_mousedown = function(){
        // 判断是否可以执行鼠标操作
        var device_name = $('#control_device_name').html();
        if (device_name == '') {
            return;
        }
        var info = $.devices.devices_info[device_name];
        if(info.status != 'ready'){
            return;
        }

        // 登记信息
        $.devices.set_touch_info(device_name);

        var pos = getRealControlScreenPos(
            getMousePos(event, $('#control_canvas_id').parent())
        );

        // 确定需要操作的设备清单
        $.devices.touch_info['devices'] = $.devices.get_selected_devices();

        // 绑定事件
        $(document.body).bind("mousemove",$.devices.onscreen_mousemove);
        $(document.body).bind("mouseup",$.devices.onscreen_mouseup);

        $.devices.touch_last_pos = pos;
        $.devices.touch_last_time = new Date(); //获取当前时间

        // 发送请求
        $.devices.emit_control(
            $.devices.touch_info['devices'], 'minitouch',
            { 'cmd': 'down', 'x': pos.x, 'y': pos.y}
        );

        // 启动后面的监听
        $.devices.touch_down = true;
    };

    /**
     * 屏幕上移动鼠标的事件
     */
    $.devices.onscreen_mousemove = function(){
        if ($.devices.touch_down){
            // 只有在鼠标按下的情况才处理, 先判断是否已达到移动的时间差
            var now = new Date();
            var dateDiff = now.getTime() - $.devices.touch_last_time;//时间差的毫秒数
            if(dateDiff < $.sysconfig.config.touch_min_move_time * 1000){
                // 未达到时间间隔
                return;
            }

            var pos = getMousePos(event, $('#control_canvas_id').parent());
            var show_size = $.devices.touch_info['show_size'];
            if (pos.x < 0 || pos.x > show_size[0] || pos.y < 0 || pos.y > show_size[1]){
                // 越界了直接当作执行鼠标松开操作
                $.devices.touch_down = false;
                $(document.body).unbind("mousemove",$.devices.onscreen_mousemove);
                $(document.body).unbind("mouseup",$.devices.onscreen_mouseup);

                // 先执行移动，再执行松开鼠标
                pos = getRealControlScreenPos(pos);
                $.devices.emit_control(
                    $.devices.touch_info['devices'], 'minitouch',
                    { 'cmd': 'move', 'x': pos.x, 'y': pos.y}
                );

                $.devices.emit_control(
                    $.devices.touch_info['devices'], 'minitouch',
                    { 'cmd': 'up'}
                );
            }else{
                // 判断位移是否超过10px
                pos = getRealControlScreenPos(pos);
                if (Math.abs(pos.x - $.devices.touch_last_pos.x) > 10 || Math.abs(pos.y - $.devices.touch_last_pos.y) > 10){
                    $.devices.touch_last_pos = pos;
                    $.devices.emit_control(
                        $.devices.touch_info['devices'], 'minitouch',
                        { 'cmd': 'move', 'x': pos.x, 'y': pos.y}
                    );
                    $.devices.touch_last_time = new Date(); //获取当前时间
                }
            }
        }
    };

    /**
     * 屏幕上移动鼠标的事件(用于显示位置)
     */
    $.devices.onscreen_mousemove_pos_show = function(){
        var pos = getMousePos(event, $('#control_canvas_id').parent());
        var show_size = $.devices.touch_info['show_size'];
        var x_obj = $('#control_pos_x');
        var y_obj = $('#control_pos_y');
        if (pos.x < 0 || pos.x > show_size[0] || pos.y < 0 || pos.y > show_size[1]){
            // 越界了，不显示位置
            x_obj.html('');
            y_obj.html('');
        }
        else{
            pos = getRealControlScreenPos(pos);
            x_obj.html(pos.x.toString());
            y_obj.html(pos.y.toString());
        }
    };

    /**
     * 屏幕上松开鼠标的事件
     */
    $.devices.onscreen_mouseup = function(){
        if ($.devices.touch_down){
            // 只有在鼠标按下的情况才处理
            $.devices.touch_down = false;
            $(document.body).unbind("mousemove",$.devices.onscreen_mousemove);
            $(document.body).unbind("mouseup",$.devices.onscreen_mouseup);

            // 判断位置是否越界，如果越界了则按范围内执行
            var pos = getRealControlScreenPos(
                getMousePos(event, $('#control_canvas_id').parent())
            );

            // 看是否要移动
            if (pos.x != $.devices.touch_last_pos.x || pos.y != $.devices.touch_last_pos.y){
                $.devices.emit_control(
                    $.devices.touch_info['devices'], 'minitouch',
                    { 'cmd': 'move', 'x': pos.x, 'y': pos.y}
                );
            }

            // 松开鼠标
            $.devices.emit_control(
                $.devices.touch_info['devices'], 'minitouch',
                { 'cmd': 'up'}
            );
        }
    };

    /**
     * 根据当前位置换算为设备真实位置
     *
     * @param {json} pos - 当前位置
     */
    function getRealControlScreenPos(pos){
        // 获取实际在区域内的位置
        var show_size = $.devices.touch_info['show_size'];
        var x = pos.x;
        var y = pos.y;
        x = Math.max(x, 0);
        x = Math.min(x, show_size[0]);
        y = Math.max(y, 0);
        y = Math.min(y, show_size[1]);

        // 执行转换
        x = parseInt(x * $.devices.touch_info['scale_x']);
        y = parseInt(y * $.devices.touch_info['scale_y']);

        // 返回
        return {'x': x, 'y': y};
    };

    /**
     * 获取鼠标在对象上的相对位置
     * @param {*} event - 全局事件对象
     * @param {JQuery} jq_obj - 对象
     */
    function getMousePos(event, jq_obj) {
        // 获取鼠标在文档中的位置
        var e = event || window.event;
        var scrollX = document.documentElement.scrollLeft || document.body.scrollLeft;
        var scrollY = document.documentElement.scrollTop || document.body.scrollTop;
        var x = e.pageX || e.clientX + scrollX;
        var y = e.pageY || e.clientY + scrollY;

        // 获取对象在文档中的位置
        var obj_pos = $(jq_obj).getElementPos();
        return { 'x': parseInt(x - obj_pos.x), 'y': parseInt(y - obj_pos.y) };
    };

    /**
     * 以下为其他控制操作
     *
     */

    /**
     * 执行adb任务
     *
     * @param {string} job - 要执行的参数
     * @param {json} para - 工作参数
     */
    $.devices.send_adb_job = function(job, para){
        if (para === undefined){
            para = {};
        }
        para['cmd'] = job;  // 把操作任务命令送入
        var selected_devices = $.devices.get_selected_devices();
        $.devices.emit_control(
            selected_devices, 'adb', para
        );
    };

})(jQuery);