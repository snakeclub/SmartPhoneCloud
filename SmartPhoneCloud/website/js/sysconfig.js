/**
 * Copyright 2018 黎慧剑
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * 智能手机群控后台学习版 - 系统参数处理模块
 * @file (sysconfig.js)
 * @author (黎慧剑)
 * @version (0.1.0)
 */

;
(function ($) {
    /**
     * 定义插件名称，避免不同插件之间相互干扰
     * @class sysconfig
     */
    $.sysconfig = new Object();

    // 当前最新的系统参数
    $.sysconfig.config = null;

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
     * 配置信息界面配置字典
     * 字典定义如下:
     * 1. 数组的每个项属于一组输入控件, group_name定义了显示的组名, 可以不设置组名; inputs 定义了每一个输入项的数组;
     * 2. 每个输入项的固定配置说明如下:
     * id - 输入项的唯一标识, 用于生成控件的真实id (格式为'{form_id}_{id}'), 同时也会在输入控件上设置为 v_name 的值，用于匹配更新值的字典;
     * show_name - 控件显示名称
     * v_type - 控件的数据类型, 支持 str int bool
     * ctrl_type - 控件类型, 默认为 text, 支持 text - 输入框, textarea - 多行输入框, checkbox - 复选框, newline - 换行
     * width - 控件占布局宽度单位, 默认为4, 总宽度为12, 如果一行的布局宽度大于 12 则将控件放在下一行
     * plaintext - 值设置为null, 指定控件仅显示文本(例如不显示输入框样式, 只有文本值), 可以与readonly配套使用
     * max_width - 用于指定输入对象的最大宽度(比如布局占用12, 但最大宽度可以设置为100px)
     * 3. 不同控件类型的个性配置项说明如下:
     * (1)checkbox
     * group - 分组名, 指示相邻的 checkbox 对象分配在同一个组显示 (分组名必须一样)
     * group_show - 分组显示, 如果不传则不显示分组名
     * inline - 指示同一组的 checkbox 对象防止在同一行中 (否则将垂直对齐显示)
     * (2)textarea
     * rows - 指定输入框显示行数
     * 4. 除以上的标准输入项和不同类型的特定配置以外, 其余参数都会直接添加到输入控件的属性中(attr), 如果值为 null 代表只添加属性名;
     * 5. bootstap 常用的标准属性值参考如下:
     * value - 输入控件当前设置值, 可用于 text, checkbox 控件
     * readonly - 输入控件值不可编辑, 值设置为null
     * disabled - 禁用输入控件, 值设置为null
     * placeholder - 输入框没有值时的提示文本
     *
     */
    $.sysconfig.config_ui_json = [{
        'group_name': 'Web服务器配置',
        'inputs': [{
                'id': 'site',
                'show_name': '访问IP或域名',
                'ctrl_type': 'text',
                'width': '3',
                'value': '127.0.0.1'
            },
            {
                'id': 'host',
                'show_name': '监听IP',
                'ctrl_type': 'text',
                'width': '3',
                'value': '127.0.0.1'
            },
            {
                'id': 'port',
                'show_name': '监听端口',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '5000'
            },
            {
                'id': 'processes',
                'show_name': '进程数',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '1'
            },
            {
                'ctrl_type': 'newline'
            },
            {
                'id': 'use_wsgi',
                'show_name': '使用WSGI服务',
                'v_type': 'bool',
                'ctrl_type': 'checkbox',
                'width': '2',
                'checked': 'checked'
            },
            {
                'id': 'json_as_ascii',
                'show_name': 'JSON兼容ASCII编码',
                'v_type': 'bool',
                'ctrl_type': 'checkbox',
                'width': '2'
            },
            {
                'id': 'threaded',
                'show_name': '使用多线程',
                'v_type': 'bool',
                'ctrl_type': 'checkbox',
                'width': '2',
                'checked': 'checked'
            }
        ]
    },
    {
        'group_name': 'SocketIO服务器配置',
        'inputs': [
            {
                'id': 'socketio_host',
                'show_name': '监听IP',
                'ctrl_type': 'text',
                'width': '3',
                'value': '127.0.0.1'
            },
            {
                'id': 'socketio_port',
                'show_name': '监听端口',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '5001'
            },
            {
                'id': 'socketio_json_as_ascii',
                'show_name': 'JSON兼容ASCII编码',
                'v_type': 'bool',
                'ctrl_type': 'checkbox',
                'width': '2'
            },
        ]
    },
    {
        'group_name': '设备检测配置',
        'inputs': [{
                'id': 'adb',
                'show_name': 'adb命令名',
                'v_type': 'str',
                'ctrl_type': 'text',
                'width': '3',
                'value': 'adb'
            },
            {
                'id': 'shell_encoding',
                'show_name': '命令窗口编码',
                'v_type': 'str',
                'ctrl_type': 'text',
                'width': '3',
                'value': 'GBK',
                'placeholder': '通常windows为GBK，linux为utf-8'
            },
            {
                'id': 'wifi_port',
                'show_name': '默认Wifi连接端口',
                'v_type': 'str',
                'ctrl_type': 'text',
                'width': '3',
                'value': '5555'
            },
        ]
    },
    {
        'group_name': 'minicap配置',
        'inputs': [
        {
                'id': 'minicap_host',
                'show_name': '服务IP',
                'ctrl_type': 'text',
                'width': '3',
                'value': '127.0.0.1'
        },{
            'id': 'minicap_port',
            'show_name': '服务端口',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '9002'
        },{
            'id': 'enable_minicap_on_start',
            'show_name': '启动时启用minicap',
            'v_type': 'bool',
            'ctrl_type': 'checkbox',
            'width': '2',
            'checked': 'checked'
        },{
            'id': 'start_wait_time',
            'show_name': '等待设备minicap启动时长(秒)',
            'v_type': 'float',
            'ctrl_type': 'text',
            'width': '3',
            'value': '5.0'
        },{
            'id': 'foward_port_start',
            'show_name': '映射端口范围开始',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '1701'
        },{
            'id': 'foward_port_end',
            'show_name': '映射端口范围结束',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '1799'
        },{
            'id': 'control_width',
            'show_name': '控制机显示宽度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '320'
        },{
            'id': 'control_height',
            'show_name': '控制机显示高度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '480'
        },{
            'id': 'control_canvas_width',
            'show_name': '控制机画布宽度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '320'
        },{
            'id': 'control_canvas_height',
            'show_name': '控制机画布高度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '480'
        },{
            'id': 'list_width',
            'show_name': '列表机显示宽度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '100'
        },{
            'id': 'list_height',
            'show_name': '列表机显示高度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '150'
        },{
            'id': 'list_canvas_width',
            'show_name': '列表机画布宽度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '100'
        },{
            'id': 'list_height',
            'show_name': '列表机画布高度',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '150'
        },{
            'id': 'lock_scale',
            'show_name': '是否锁定比例',
            'v_type': 'bool',
            'ctrl_type': 'checkbox',
            'width': '2',
            'checked': 'checked'
        },{
            'id': 'lock_by',
            'show_name': '比例依赖方向',
            'v_type': 'str',
            'ctrl_type': 'text',
            'width': '3',
            'value': 'width'
        },{
            'id': 'orientation',
            'show_name': '视频旋转方向0|90|180|270',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '0'
        },
        {
            'id': 'quality',
            'show_name': '视频质量',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '80'
        },
        {
            'id': 'control_frame_rate',
            'show_name': '控制机刷新率FPS',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '30'
        },
        {
            'id': 'list_frame_rate',
            'show_name': '列表机刷新率FPS',
            'v_type': 'int',
            'ctrl_type': 'text',
            'width': '3',
            'value': '10'
        },
        ]
    },
    {
        'group_name': 'minitouch配置',
        'inputs': [{
                'id': 'touch_foward_port_start',
                'show_name': '映射端口范围开始',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '1601'
            },
            {
                'id': 'touch_foward_port_end',
                'show_name': '映射端口范围结束',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '1699'
            },
            {
                'id': 'touch_buffer_size',
                'show_name': 'Socket通讯缓存大小',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '0'
            },
            {
                'id': 'touch_encoding',
                'show_name': 'Socket通讯编码',
                'v_type': 'str',
                'ctrl_type': 'text',
                'width': '3',
                'value': 'utf-8'
            },
            {
                'id': 'touch_start_wait_time',
                'show_name': '等待服务启动时长',
                'v_type': 'float',
                'ctrl_type': 'text',
                'width': '3',
                'value': '1.0'
            },
            {
                'id': 'touch_default_delay',
                'show_name': '命令执行完默认延迟时长',
                'v_type': 'float',
                'ctrl_type': 'text',
                'width': '3',
                'value': '0.05'
            },
            {
                'id': 'touch_default_pressure',
                'show_name': '操作按下默认压力大小',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '100'
            },
            {
                'id': 'touch_min_move_step',
                'show_name': '操作中判断移动的最小位置偏差',
                'v_type': 'int',
                'ctrl_type': 'text',
                'width': '3',
                'value': '10'
            },
            {
                'id': 'touch_min_move_time',
                'show_name': '操作中移动上送的最小事件差(秒)',
                'v_type': 'float',
                'ctrl_type': 'text',
                'width': '3',
                'value': '0.05'
            },
        ]
    },
    ];

    /**
     * 切换标签执行的动作
     * @param {JQuery} new_tab - 目标Tab页签的JQuery对象
     * @param {JQuery} pre_tab - 原Tab页签的JQuery对象
     */
    $.sysconfig.on_toggle_tab = function (new_tab, pre_tab) {
        switch (new_tab.attr('id')) {
            case 'nav-config-tab':
                // 切换到配置页面，自动加载最新的配置信息
                $.sysconfig.get_config(true);
                break;
        }
    };

    /**
     * 初始化界面
     */
    $.sysconfig.init_ui = function () {
        // 显示loading
        $.ui_tools.show_modal('loadingModal');
        try {
            // 初始化系统配置页面
            $('#form_config').generate_form_ui_by_json(
                $.sysconfig.config_ui_json, 'form_config_button', true
            );

            // 加载系统参数
            url = '/api/ConfigServices/get_config';
            json_data = {
                'interface_id': $.restful_api.get_interface_id()
            };

            // 调用Ajax
            $.restful_api.ajax_call(
                url, json_data, {
                    'tips': '获取系统配置信息',
                    'success_not_alert': true,
                    'success_fun': function (result) {
                        try {
                            $.sysconfig.config = result;
                            $('#form_config').set_form_values(result);
                            return [true, 'success'];
                        } catch (e) {
                            return [false, e.toString()];
                        }
                    }
                }
            );

        } catch (e) {
            // 进行异常提示
            $.ui_tools.alert(
                'function $.sysconfig.init_ui exception: ' + e.toString(),
                '告警信息', 'alert'
            );
        } finally {
            // 关闭loading必须通过异步方式执行才能关闭
            setTimeout($.ui_tools.hide_modal, 10);
        }
    };

    /**
     * 获取系统配置信息
     *
     * @param {bool} success_not_alert=false - 成功交易不提示
     */
    $.sysconfig.get_config = function (success_not_alert) {
        // 默认参数
        if (success_not_alert === undefined) {
            success_not_alert = false;
        }

        // 显示loading
        $.ui_tools.show_modal('loadingModal');
        try {
            // 准备参数
            url = '/api/ConfigServices/get_config';
            json_data = {
                'interface_id': $.restful_api.get_interface_id()
            };

            // 调用Ajax
            $.restful_api.ajax_call(
                url, json_data, {
                    'tips': '获取系统配置信息',
                    'success_not_alert': success_not_alert,
                    'success_fun': function (result) {
                        try {
                            $.sysconfig.config = result;
                            $('#form_config').set_form_values(result);
                            return [true, 'success'];
                        } catch (e) {
                            return [false, e.toString()];
                        }
                    }
                }
            );
        } catch (e) {
            // 进行异常提示
            $.ui_tools.alert(
                'function $.sysconfig.get_config exception: ' + e.toString(),
                '告警信息', 'alert'
            );
        } finally {
            // 关闭loading必须通过异步方式执行才能关闭
            setTimeout($.ui_tools.hide_modal, 10);
        }
    };

    /**
     * 设置系统配置信息
     *
     * @param {bool} success_not_alert=false - 成功交易不提示
     */
    $.sysconfig.set_config = function (success_not_alert) {
        // 默认参数
        if (success_not_alert === undefined) {
            success_not_alert = false;
        }

        // 显示loading
        $.ui_tools.show_modal('loadingModal');
        try {
            // 准备参数
            url = '/api/ConfigServices/set_config';
            json_data = $('#form_config').get_form_values_json();
            json_data['interface_id'] = $.restful_api.get_interface_id();

            // 调用Ajax
            $.restful_api.ajax_call(
                url, json_data, {
                    'tips': '设置系统配置信息',
                    'success_fun': function (result) {
                        $.sysconfig.config = json_data;
                        return [true, 'success'];
                    },
                    'success_not_alert': success_not_alert
                }
            )
        } catch (e) {
            // 进行异常提示
            $.ui_tools.alert(
                'function $.sysconfig.set_config exception: ' + e.toString(),
                '告警信息', 'alert'
            );
        } finally {
            // 关闭loading必须通过异步方式执行才能关闭
            setTimeout($.ui_tools.hide_modal, 10);
        }

    };

    /**
     * 更新设备昵称
     * @param {string} device_name - 设备名
     * @param {string} nick_name - 昵称
     * @param {bool} success_not_alert=false - 成功交易不提示
     */
    $.sysconfig.update_nick_name = function(success_not_alert){
        // 默认参数
        if (success_not_alert === undefined) {
            success_not_alert = false;
        }

        // 显示loading
        $("#btn_bind_nick_name_submit").addClass("disabled");
        try {
            // 准备参数
            url = '/api/ConfigServices/update_nick_name';
            json_data = {
                'interface_id': $.restful_api.get_interface_id(),
                'device_name': $('#bind_nick_name_device_name').val(),
                'nick_name': $('#bind_nick_name_nickname').val()
            };

            // 调用Ajax
            $.restful_api.ajax_call(
                url, json_data, {
                    'tips': '更新设备昵称',
                    'success_fun': function (result) {
                        // 更新表格对应的昵称
                        $('#devices_table').bootstrapTable(
                            'updateByUniqueId', {
                                'device_name': json_data.device_name, row: {'nick_name': json_data.nick_name}
                            }
                        );
                        return [true, 'success'];
                    },
                    'success_not_alert': success_not_alert
                }
            )
        } catch (e) {
            // 进行异常提示
            $.ui_tools.alert(
                'function $.sysconfig.update_nick_name exception: ' + e.toString(),
                '告警信息', 'alert'
            );
        } finally {
            // 关闭loading必须通过异步方式执行才能关闭
            setTimeout(function () {
                $("#btn_bind_nick_name_submit").removeClass('disabled');
            }, 10);
        }
    };

})(jQuery);
