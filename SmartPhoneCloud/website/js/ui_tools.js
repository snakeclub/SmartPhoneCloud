/**
 * Copyright 2018 黎慧剑
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * 通用界面处理工具
 * @file (ui_tools.js)
 * @author (黎慧剑)
 * @version (0.1.0)
 */

;
/**
 * 格式化字符串的通用方法
 * @example
 * console.log("我是{0}，今年{1}了. {2}".format("zhgl", 42, 0))
 * console.log("我是{name}，今年{age}了.".format({ name: "zhgl", age: 42 }))
 */
String.prototype.format = function(args) {
    if (arguments.length > 0) {
      var result = this;
      if (arguments.length == 1 && typeof(args) == "object") {
        for (var key in args) {
          var reg = new RegExp("({" + key + "})", "g");
          result = result.replace(reg, args[key]);
        }
      } else {
        for (var i = 0; i < arguments.length; i++) {
          if (arguments[i] == undefined) {
            return "";
          } else {
            var reg = new RegExp("({[" + i + "]})", "g");
            result = result.replace(reg, arguments[i]);
          }
        }
      }
      return result;
    } else {
      return this;
    }
};

String.prototype.replaceAll = function(s1,s2){
    var r = new RegExp(s1.replace(/([\{\}\^\$\+\-\*\?\.\"\'\|\/\\])/g,"\\$1"),"ig");
    return this.replace(r,s2);
};


;
(function ($) {

    /**
     * 定义插件名称，避免不同插件之间相互干扰
     * @class ui_tools
     */
    $.ui_tools = new Object();

    /**
     * 画布精度计算，通过该函数计算好精度后，再按比例进行展示
     *
     * @param {object} context - canvas.getContext('2d')获取到的对象
     */
    $.ui_tools.getPixelRatio = function(context) {
        var backingStore = context.backingStorePixelRatio ||
              context.webkitBackingStorePixelRatio ||
              context.mozBackingStorePixelRatio ||
              context.msBackingStorePixelRatio ||
              context.oBackingStorePixelRatio ||
              context.backingStorePixelRatio || 1;

        return (window.devicePixelRatio || 1) / backingStore;
    };

    /**
     * 在告警框提示debug信息($.debug为true的情况下才执行)
     * @param {string} str - 要提示的信息
     */
    function debug(str) {
        if ($.debug === true) {
            alert('debug: ' + str);
        }
    };

    /** ---------------------------
     * 提示框工具
     */


    /**
     * 告警提示框
     * @param {string} msg - 要提示的信息
     * @param {string} title='提示信息' - 标题
     * @param {string} msg_type='info' - 消息类型, 支持 alert, info
     * @param {bool} autohide=false - 是否自动隐藏
     * @param {bool} delay=1000 - 自动隐藏的延迟时间，单位为ms
     */
    $.ui_tools.alert = function (msg, title, msg_type, autohide, delay) {
        // 入参默认值
        if (title === undefined) {
            title = '提示信息';
        }

        if (msg_type === undefined) {
            msg_type = 'info';
        }

        if (autohide === undefined) {
            autohide = false;
        }

        if (delay === undefined) {
            delay = 1000;
        }

        var toast = $('#alertToast');
        toast.toast({'autohide':autohide, 'delay': delay});

        // 修改标题和告警信息
        toast.find("svg[toast-icon-type='"+msg_type+"']").removeClass('d-none');
        toast.find("svg[toast-icon-type!='"+msg_type+"']").addClass('d-none');
        toast.find('.toast-header > strong').text(title);
        toast.find('.toast-body').text(msg);

        // 显示
        toast.toast('show');
    };


    /** ---------------------------
     * 模式框（Modal）的通用处理
     */

    /**
     * 显示模态框
     *
     * @param {string} id - 要显示的模态框的内容对象id
     */
     $.ui_tools.show_modal = function(id){
        // 获取新内容的参数
        var new_content = $('#' + id);
        var options = {
            'backdrop': new_content.attr('data-backdrop'),
            'keyboard': new_content.attr('data-backdrop'),
            'focus': new_content.attr('data-focus'),
            'show': new_content.attr('data-show')
        };
        if (options.backdrop === undefined || options.backdrop == 'true'){
            options.backdrop = true;
        }
        else if(options.backdrop == 'false'){
            options.backdrop = false;
        }
        if (options.keyboard === undefined || options.keyboard == 'true'){
            options.keyboard = true;
        }
        else{
            options.keyboard = false;
        }
        if (options.focus === undefined || options.focus == 'true'){
            options.focus = true;
        }
        else{
            options.focus = false;
        }
        if (options.show === undefined || options.show == 'true'){
            options.show = true;
        }
        else{
            options.show = false;
        }

        // 有可能原来已经有内容，将内容移除掉
        modal_remove_content();

        // 将新内容移入模式窗
        var share_modal = $('#share_modal');
        new_content.removeClass('d-none')
        share_modal.attr('content_id', id);

        // 设置显示参数
        share_modal.modal(options);

        // 显示模块
        share_modal.modal('show');
     };

     /**
      * 隐藏模态框
      */
     $.ui_tools.hide_modal = function(){
        var share_modal = $('#share_modal');
        share_modal.modal('hide');
        modal_remove_content();
     };

     /**
      * 从通用模态框中移除显示内容
      */
     function modal_remove_content(){
        var share_modal = $('#share_modal');
        var content_id = share_modal.attr('content_id');
        if (content_id === undefined || content_id == ''){
            // 没有内容，无需处理
            return;
        }

        // 隐藏内容
        $('#' + content_id).addClass('d-none')

        // 删除content_id属性
        share_modal.removeAttr('content_id');
     };



    /** ---------------------------
     * 通用工具函数
     */

    /**
     * 在指定对象下生成表单输入的ui界面
     * @param {string} str - 要提示的信息
     * @param {string} hold_id='' - 要保留在form中的对象id(只能保留1个)
     * @param {bool} is_last=true - 要保留的对象是否最后一个
     */
    $.fn.generate_form_ui_by_json = function (json_object, hold_id, is_last) {
        try {
            // 默认值
            if (hold_id === undefined) {
                hold_id = '';
            }
            if (is_last === undefined) {
                is_last = true;
            }

            // 清除表单对象所有内容
            if (hold_id != ''){
                // 保留一个对象
                $(this).children('*:not(#'+hold_id+')').remove();
            }
            else{
                // 清除所有对象
                $(this).empty();
            }

            // 遍历 json_object 对象
            for (var i in json_object) {
                generate_form_ui_group(
                    $(this), json_object[i].group_name, json_object[i].inputs, hold_id, is_last
                );
            }

            // 处理完成把保留对象移动到合适位置
            if (hold_id != '' && is_last){
                $('#' + hold_id).insertAfter('#'+$(this).attr('id')+' > div:last-child');
            }
        } catch (e) {
            debug('function generate_ui_by_json exception: ' + e.toString());
            throw e;
        }
    };

    /**
     * 获取指定表单当前取值的json对象
     */
    $.fn.get_form_values_json = function() {
        var json = {};
        // 获取具有 v_name 属性的对象
        var inputs = $(this).find('*[v_name]');
        for(var i=0; i<inputs.length; i++){
            control = $(inputs.get(i));
            value = control.val();
            v_type = control.attr('v_type');
            if (v_type === undefined){
                v_type = 'str';
            }
            if (control.get(0).tagName.toUpperCase() == 'INPUT'){
                switch(control.get(0).type.toLowerCase()){
                    case 'checkbox':
                        // 复选框
                        if (v_type == 'bool'){
                            // 取是否选中
                            value = control.get(0).checked;
                        }
                        break;
                }
            }
            json[control.attr('v_name')] = convert_value(value, v_type);
        }
        // 返回对象
        return json;
    };

    /**
     * 通过json对象设置指定表单的值
     * @param {json} json_data
     */
    $.fn.set_form_values = function(json_data) {
        // 获取具有 v_name 属性的对象
        var inputs = $(this).find('*[v_name]');
        for(var i=0; i<inputs.length; i++){
            control = $(inputs.get(i));
            v_name = control.attr('v_name');
            if (!(v_name in json_data)){
                throw new Error("can't find [" + v_name + "] in json data!");
            }
            v_value = json_data[v_name];
            v_type = control.attr('v_type');
            if (v_type === undefined){
                v_type = 'str';
            }
            is_dealed = false;
            if (control.get(0).tagName.toUpperCase() == 'INPUT'){
                switch(control.get(0).type.toLowerCase()){
                    case 'checkbox':
                        // 复选框
                        if (v_type == 'bool'){
                            control.prop('checked', v_value);
                            is_dealed = true;
                        }
                        break;
                }
            }
            // 没有特殊处理的，都直接放入 val 中
            if (!is_dealed){
                control.val(v_value.toString())
            }
        }
    };


    /** ---------------------------
     * 内部函数
     */

    /**
     * 获取对象属性值
     * @param {object} obj - 要处理的对象
     * @param {string} attr_name - 要获取的属性值
     * @param {object} default_value - 获取不到返回的默认值
     */
    function get_object_attr(obj, attr_name, default_value) {
        if (attr_name in obj) {
            return obj[attr_name];
        } else {
            return default_value;
        }
    };

    /**
     * 生成表单对象分组输入UI
     * @param {JQObject} form_obj - 要生成界面的表单对象
     * @param {string} group_name - 组名
     * @param {array} inputs - 要生成的输入对象数组
     * @param {string} hold_id='' - 要保留在form中的对象id(只能保留1个)
     * @param {bool} is_last=true - 要保留的对象是否最后一个
     */
    function generate_form_ui_group(form_obj, group_name, inputs, hold_id, is_last) {
        try {
            // 创建标题和分割线, 兼容有保留对象的情况
            if (group_name != "" || (hold_id == '' && !$.isEmptyObject(form_obj)) || (hold_id != '' && !is_last)) {
                // 添加标题和分割线
                form_obj.append('<h4 class="page-header">' + group_name + '</h4>');
            }

            // 创建行对象
            line_html = '<div class="form-row align-items-center"></div>';
            form_obj.append(line_html);
            line_obj = form_obj.children("div:last-child");

            // 创建每个输入项
            total_width = 0; // 用于计算每行是否已超过12格，如果超过需要换新行
            for (var i in inputs) {
                para = inputs[i];
                ctrl_type = get_object_attr(para, 'ctrl_type', 'text');
                width = parseInt(get_object_attr(para, 'width', '4'));

                switch (ctrl_type) {
                    case 'newline':
                        //直接换一个新行
                        form_obj.append(line_html);
                        line_obj = form_obj.children("div:last-child");
                        total_width = 0;
                        break;
                    default:
                        // 先判断是否要新增一个行
                        if (total_width + width > 12) {
                            total_width = 0;
                            form_obj.append(line_html);
                            line_obj = form_obj.children("div:last-child");
                        }
                        total_width = total_width + width;
                        // 添加输入控件
                        generate_form_ui_input(form_obj.attr('id'), line_obj, para);
                        break;
                }
            }
        } catch (e) {
            debug('function generate_form_ui_group exception: ' + e.toString());
            throw e;
        }
    };

    /**
     * 生成表单输入对象UI
     * @param {str} form_id - 表单id
     * @param {JQObject} parent_obj - 输入对象所在的父对象
     * @param {object} para - 输入参数
     */
    function generate_form_ui_input(form_id, parent_obj, para) {
        try {
            var html = '';
            var id = '';
            var fixed_attr;
            switch (get_object_attr(para, 'ctrl_type', 'text')) {
                case 'text':
                    // 文本输入框
                    fixed_attr = ['id', 'show_name', 'width', 'plaintext', 'max_width', 'ctrl_type'];
                    html = '<div class="form-group col-md-{width}">' +
                        '<label for="{form_id}_{id}">{show_name}</label>' +
                        '<input type="text" class="form-control" id="{form_id}_{id}" v_name="{id}">' +
                        '</div>';
                    html = html.format({
                        'form_id': form_id,
                        'id': para['id'],
                        'show_name': para['show_name'],
                        'width': get_object_attr(para, 'width', '4')
                    });
                    break;
                case 'textarea':
                    // 多行输入
                    fixed_attr = ['id', 'show_name', 'width', 'plaintext', 'max_width', 'ctrl_type', 'rows'];
                    html = '<div class="form-group col-md-{width}">' +
                        '<label for="{form_id}_{id}">{show_name}</label>' +
                        '<textarea rows="{rows}" class="form-control" id="{form_id}_{id}" v_name="{id}"></textarea>' +
                        '</div>';
                    html = html.format({
                        'form_id': form_id,
                        'id': para['id'],
                        'show_name': para['show_name'],
                        'width': get_object_attr(para, 'width', '4'),
                        'rows': get_object_attr(para, 'rows', '3'),
                    });
                    break;
                case 'checkbox':
                    // 复选框
                    fixed_attr = ['id', 'show_name', 'width', 'plaintext', 'max_width', 'ctrl_type', 'inline', 'group', 'group_show'];
                    html = '<div class="form-check{inline}">' +
                        '<input class="form-check-input" type="checkbox" id="{form_id}_{id}" checked="{checked}" value="{value}" v_name="{id}" v_type="{v_type}">' +
                        '<label class="form-check-label" for="{form_id}_{id}">' +
                        '{show_name}' +
                        '</label>' +
                        '</div>';
                    html = html.format({
                        'form_id': form_id,
                        'id': para['id'],
                        'show_name': para['show_name'],
                        'inline': get_object_attr(para, 'inline', false) ? ' form-check-inline':''
                    });

                    //判断有没有分组
                    group = get_object_attr(para, 'group', '');
                    group_show = get_object_attr(para, 'group_show', '');
                    if (group != '') {
                        // 多个放在一个分组里
                        group_obj = parent_obj.children('div[group="' + group + '"]');
                        if (group_obj.length == 0) {
                            group_html = '<div class="form-group col-md-{width}" group="' + group + '">' +
                            (group_show == ''?'':'<label>{group_show}</label>') +
                            '</div>';
                            group_html = group_html.format({
                                'width': get_object_attr(para, 'width', '4'),
                                'group_show': group_show
                            });
                            parent_obj.append(group_html);
                            group_obj = parent_obj.children('div[group="' + group + '"]');
                        }
                        parent_obj = group_obj;
                    }
                    else{
                        html = '<div class="form-group col-md-{width}">' + html + '</div>';
                        html = html.format({
                            'width': get_object_attr(para, 'width', '4')
                        });
                    }
                    break;
            }

            // 添加到对象中
            if (html != '') {
                parent_obj.append(html);
                id = form_id + '_' + para['id'];
                insert_obj = parent_obj.find("#" + id);

                // 增加通用属性
                for (var key in para){
                    if (fixed_attr.includes(key)){
                        // 固定的属性不再处理
                        continue;
                    }
                    if (para[key] == null){
                        insert_obj.attr(key, '');
                    }
                    else{
                        insert_obj.attr(key, para[key]);
                    }
                }

                // plaintext 属性
                if ('plaintext' in para){
                    insert_obj.addClass('form-control-plaintext');
                }

                // 看是否存在通过CSS控制最大显示宽度的情况
                _max_width = get_object_attr(para, 'max_width', '');
                if (_max_width != '') {
                    insert_obj.css("max-width", max_width);
                }
            }
        } catch (e) {
            debug('function generate_form_ui_input exception: ' + e.toString());
            throw e;
        }
    };

    /**
     * 按照数据类型转换值
     * @param {string} value
     * @param {string} v_type - 支持 str int bool
     * @returns {object} - 返回转换后的对象
     */
    function convert_value(value, v_type){
        converted = value;
        switch(v_type){
            case 'int':
                converted = Number(value);
                break;
            case 'float':
                converted = parseFloat(value);
                break;
            case 'bool':
                converted = Boolean(value);
                break;
            case 'str':
                converted = value.toString();
                break;
        }
        return converted;
    };




})(jQuery);