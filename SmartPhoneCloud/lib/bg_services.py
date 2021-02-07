#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
# Copyright 2019 黎慧剑
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""
后台标准服务模块
@module bg_services
@file bg_services.py
"""

import os
import sys
import threading
import sqlite3
import logging
import traceback
from flask import request, render_template
from HiveNetLib.base_tools.run_tool import RunTool
from HiveNetLib.simple_restful.server import FlaskTool, FlaskServer
from HiveNetLib.simple_restful.socketio import SocketIOServer
from HandLessRobot.lib.controls.adb_control import AdbTools, AppDevice, EnumAndroidKeycode
from HandLessRobot.lib.controls.minitouch_control import MiniTouchCmdBuilder, MiniTouchServer
from HandLessRobot.lib.controls.minicap_control import MiniCapServer
# 根据当前文件路径将包路径纳入，在非安装的情况下可以引用到
sys.path.append(os.path.abspath(os.path.join(
    os.path.dirname(__file__), os.path.pardir, os.path.pardir)))
from SmartPhoneCloud.lib.plugin import PluginManager


__MOUDLE__ = 'bg_services'  # 模块名
__DESCRIPT__ = u'后台标准服务模块'  # 模块描述
__VERSION__ = '0.1.0'  # 版本
__AUTHOR__ = u'黎慧剑'  # 作者
__PUBLISH__ = '2021.01.12'  # 发布日期


class ConfigServices(object):
    """
    参数配置服务
    """

    #############################
    # 构造函数
    #############################
    def __init__(self, **kwargs):
        """
        参数配置服务

        @param {str} config_path=None - 配置文件所在目录(sqlite文件)
        @param {str} shared_path=None - 共享库文件所在目录(minicap等共享库所在目录)
        @param {simple_log.Logger} logger=None - 日志对象
        """
        self.kwargs = kwargs
        self.logger = kwargs.get('logger', None)
        if self.logger is None:
            self.logger = logging.getLogger()

        # 配置目录
        self.config_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), os.path.pardir, 'config')
        ) if self.kwargs.get('config_path', None) is None else self.kwargs['config_path']

        self.shared_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), os.path.pardir, 'shared')
        ) if self.kwargs.get('shared_path', None) is None else self.kwargs['shared_path']

        # 内部的控制变量
        self._db_lock = threading.RLock()  # 数据访问锁，保证单线程访问

        # 连接配置库, 需要允许多线程访问
        self.db_conn = sqlite3.connect(
            os.path.join(self.config_path, 'info.db'), check_same_thread=False
        )
        # 创建所需的配置表
        self._exec_sql(
            'create table if not exists t_para(p_name varchar(30) primary key, p_type varchar(30), p_value varchar(500))'
        )  # 系统参数表

        # 获取系统初始化参数
        _fetchs = self._exec_sql('select * from t_para', is_fetchall=True)
        self.para = {
            # Web服务器配置
            'site': '127.0.0.1',
            'host': '127.0.0.1',
            'port': 5000,
            'threaded': True,
            'processes': 1,
            'json_as_ascii': False,
            'use_wsgi': True,
            # SocketIO服务器配置
            'socketio_host': '127.0.0.1',
            'socketio_port': 5001,
            'socketio_json_as_ascii': False,
            # 设备检测配置
            'adb': 'adb',
            'shell_encoding': 'utf-8',  # GBK
            'wifi_port': '5555',
            # minicap配置
            'minicap_host': '127.0.0.1',  # 服务ip
            'minicap_port': 9002,  # 服务端口
            'enable_minicap_on_start': True,  # 是否在启动时启用minicap
            'start_wait_time': 1.0,  # 等待设备minicap启动时长（秒）
            'foward_port_start': 1701,  # 映射端口的开始
            'foward_port_end': 1799,  # 映射端口的结束
            'control_width': 280,  # 控制机的显示宽度
            'control_height': 450,  # 控制机的显示高度
            'control_canvas_width': 400,  # 控制机的画布显示宽度
            'control_canvas_height': 800,  # 控制机的画布显示高度
            'list_width': 100,  # 列表机宽度
            'list_height': 150,  # 列表机高度
            'list_canvas_width': 200,  # 列表机画布宽度
            'list_canvas_height': 300,  # 列表机画布高度
            'lock_scale': True,  # 锁定比例
            'lock_by': 'width',  # 按宽度锁定比例
            'orientation': 0,  # 手机旋转角度，支持 0 | 90 | 180 | 270
            'quality': 80,  # 视频质量，可设置0-100，降低视频质量可提高性能
            'control_frame_rate': 30,  # 控制机的刷新频率, 降低可以提高性能
            'list_frame_rate': 10,  # 列表机的刷新频率，降低可以提高性能
            # minitouch配置
            'touch_foward_port_start': 1601,  # 映射端口开始
            'touch_foward_port_end': 1699,  # 映射端口结束
            'touch_buffer_size': 0,  # socket缓存大小
            'touch_encoding': 'utf-8',  # socket编码
            'touch_start_wait_time': 1.0,  # 等待启动完成时长
            'touch_default_delay': 0.05,  # 每次命令执行完默认延迟时长
            'touch_default_pressure': 100,  # 操作按下默认压力大小
            'touch_min_move_step': 10,  # 移动鼠标发送指令的最小移动位置
            'touch_min_move_time': 0.05,  # 登记移动鼠标的最小时间差，单位为秒
        }  # 默认值
        self._dbrows_to_para(_fetchs, self.para)
        # 刷新回数据库
        self._update_db_para(self.para, 't_para')
        # 将shell_encoding刷入全局变量
        RunTool.set_global_var('SHELL_ENCODING', self.para['shell_encoding'])

        # 创建所需的昵称映射表
        self._exec_sql(
            'create table if not exists t_nick_name(device_name varchar(100) primary key, nick_name varchar(100))'
        )  # 昵称映射表

    #############################
    # 首页的模板处理函数
    #############################
    def index(self):
        """
        网站的首页, 控制模板渲染显示
        """
        _plugin_manager = RunTool.get_global_var('PLUGIN_MANAGER')
        # 插件
        _plugins_dict = _plugin_manager.plugins_dict
        # 浮动工具栏入口的插件清单(新打开页面)
        _plugins_toolbar = list()
        for _plugin_name in _plugin_manager.plugins_toolbar:
            _plugins_toolbar.append((
                _plugins_dict[_plugin_name]['show_name'],
                _plugins_dict[_plugin_name]['url']
            ))

        # 将本地变量进行传参
        return render_template(
            ['index.html', 'devices/float_toolbar.html'], plugins_toolbar=_plugins_toolbar
        )

    #############################
    # RestFul Api
    #############################
    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def get_config(self, methods=['POST'], **kwargs):
        """
        获取系统配置

        @api {post} {json} /api/ConfigServices/get_config get_config
        @body-in {str} interface_id - 接口id

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {str} site - 访问IP或域名
        @body-out {str} host - 监听IP
        @body-out {int} port - 监听端口
        @body-out {int} processes - 进程数
        @body-out {bool} use_wsgi - 是否使用WSGI服务器
        @body-out {bool} json_as_ascii - JSON兼容ASCII编码
        @body-out {bool} threaded - 是否使用多线程
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _resp = {
            'interface_id': request.json.get('interface_id', ''),
            'status': '00000',
            'msg': '成功'
        }
        try:
            _resp.update(self.para)
            return _resp
        except Exception as e:
            _resp['status'] = '21599'
            _resp['msg'] = str(e)
            if _logger is not None:
                _logger.log(
                    _logging_level,
                    '[EX][interface_id:%s]%s' % (_resp['interface_id'], traceback.format_exc()),
                    extra=_logger_extra
                )
            return _resp

    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def set_config(self, methods=['POST'], **kwargs):
        """
        更新系统配置

        @api {post} {json} /api/ConfigServices/set_config set_config
        @body-in {str} interface_id - 接口id
        @body-in {str} site - 访问IP或域名
        @body-in {str} host - 监听IP
        @body-in {int} port - 监听端口
        @body-in {int} processes - 进程数
        @body-in {bool} use_wsgi - 是否使用WSGI服务器
        @body-in {bool} json_as_ascii - JSON兼容ASCII编码
        @body-in {bool} threaded - 是否使用多线程

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _resp = {
            'interface_id': request.json.get('interface_id', ''),
            'status': '00000',
            'msg': '成功'
        }
        try:
            _para: dict = request.json
            _para.pop('interface_id')
            self.para.update(_para)
            self._update_db_para(self.para, 't_para')
            return _resp
        except Exception as e:
            _resp['status'] = '21599'
            _resp['msg'] = str(e)
            if _logger is not None:
                _logger.log(
                    _logging_level,
                    '[EX][interface_id:%s]%s' % (_resp['interface_id'], traceback.format_exc()),
                    extra=_logger_extra
                )
            return _resp

    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def update_nick_name(self, methods=['POST'], **kwargs):
        """
        更新设备昵称

        @api {post} {json} /api/ConfigServices/update_nick_name update_nick_name
        @body-in {str} interface_id - 接口id
        @body-in {str} device_name - 设备名
        @body-in {str} nick_name - 昵称

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _resp = {
            'interface_id': request.json.get('interface_id', ''),
            'status': '00000',
            'msg': '成功'
        }
        try:
            _data = request.json
            self._update_db_nick_name(_data)
            # 通知客户端进行变更
            _change_status_devices = RunTool.get_global_var('CHANGE_STATUS_DEVICES')
            _change_status_devices[_data['device_name']] = dict()
            _change_status_devices[_data['device_name']]['change_type'] = 'nick_name'
            _change_status_devices[_data['device_name']]['nick_name'] = _data['nick_name']
            return _resp
        except Exception as e:
            _resp['status'] = '21599'
            _resp['msg'] = str(e)
            if _logger is not None:
                _logger.log(
                    _logging_level,
                    '[EX][interface_id:%s]%s' % (_resp['interface_id'], traceback.format_exc()),
                    extra=_logger_extra
                )
            return _resp

    #############################
    # 内部函数
    #############################

    def _exec_sql(self, sql: str, para: tuple = None, is_fetchall: bool = False):
        """
        执行指定SQL

        @param {str} sql - 要执行的SQL
        @param {tuple} para=None - 传入的SQL参数字典(支持?占位)
        @param {bool} is_fetchall=False - 是否返回执行结果数据

        @param {list} - 如果is_fetchall为True则返回fetchall获取的结果数据, 否则返回None
        """
        self._db_lock.acquire()
        _cursor = self.db_conn.cursor()
        try:
            if para is None:
                _cursor.execute(sql)
            else:
                _cursor.execute(sql, para)

            # 是否查询结果
            if is_fetchall:
                return _cursor.fetchall()
            else:
                # 非查询语句要提交
                self.db_conn.commit()
                return None
        finally:
            _cursor.close()
            self._db_lock.release()

    def _dbrows_to_para(self, fetchs, para: dict):
        """
        通用的将数据库查询记录存入字典的函数

        @param {list} fetchs - fetchall 获取的行数组
        @param {dict} para - 要存入的参数字典
        """
        for _item in fetchs:
            if _item[1] == 'bool':
                # python boo 和 str 的转换不能使用 bool('False') 的方式
                para[_item[0]] = (_item[2] == 'True')
            elif _item[1] == 'str':
                para[_item[0]] = _item[2]
            else:
                para[_item[0]] = eval('%s("%s")' % (_item[1], _item[2]))

    def _dbtype_to_python(self, val, type_str: str = None):
        """
        转换数据库类型为Python类型

        @param {object} val - 数据库存储值
        @param {str} type_str=None - 转换类型
            'bool' - 布尔值

        @returns {object} - 转换后的值
        """
        _val = val
        if type_str == 'bool':
            _val = (val == 'true')

        return _val

    def _python_to_dbtype(self, val, type_str: str = None):
        """
        转换python类型为数据库类型

        @param {object} val - 数据库存储值
        @param {str} type_str=None - 转换类型
            'bool' - 布尔值

        @returns {object} - 转换后的值
        """
        _val = val
        if type_str == 'bool':
            _val = 'true' if val else 'false'

        return _val

    def _update_db_para(self, para: dict, table_name: str):
        """
        将参数更新回数据库

        @param {dict} para - 参数字典
        @param {str} table_name - 要刷回的数据库名
        """
        for _key, _value in para.items():
            self._exec_sql(
                "replace into %s values(?, ?, ?)" % table_name,
                para=(_key, type(_value).__name__, str(_value))
            )

    def _update_db_nick_name(self, row: dict):
        """
        更新昵称映射到数据库

        @param {dict} row - 行字典
            {
                'device_name': '设备名',
                'nick_name': '昵称'
            }
        """
        self._exec_sql(
            "replace into t_nick_name values(?, ?)",
            para=(row['device_name'], row['nick_name'])
        )

    def _get_db_nick_name(self, device_name: str) -> str:
        """
        返回设备对应的昵称

        @param {str} device_name - 设备名称

        @returns {str} - 昵称，如果找不到记录返回设备名
        """
        _fetchs = self._exec_sql(
            'select nick_name from t_nick_name where device_name=?',
            para=(device_name, ), is_fetchall=True
        )
        if len(_fetchs) == 0:
            return device_name
        else:
            return _fetchs[0][0]


class DeviceServices(object):
    """
    设备管理服务
    """

    #############################
    # 构造函数
    #############################
    def __init__(self, **kwargs):
        """
        设备管理服务

        @param {object} config_services - 配置服务实例对象
        @param {object} socketio_server - socketio实例对象
        @param {simple_log.Logger} logger=None - 日志对象
        """
        self.logger = kwargs.get('logger', None)

        # 获取通用的配置信息
        self.config_services: ConfigServices = kwargs.get('config_services')
        self.socketio_server: SocketIOServer = kwargs.get('socketio_server')

        # 设备清单信息字典, key为设备号, value为设备信息字典
        # status {str} - 'init' - 初始化中, 'ready' - 就绪, 'ready-no-screen' - 无屏幕同步的就绪, 'error' - 处理失败
        self.devices = dict()
        self.change_status_devices = dict()  # 需变更设备状态的设备名称和状态字典
        RunTool.set_global_var('CHANGE_STATUS_DEVICES', self.change_status_devices)  # 公布到全局变量
        # 不发送给客户端的设备其他信息
        self.devices_inner_info = dict()

        # 登记当前属于控制端的设备号
        self.control_device = ''

        # 初始化同步工具
        _config_para = self.config_services.para
        self.minicap_server = MiniCapServer(
            adb_name=_config_para['adb'],
            webserver_port=_config_para['minicap_port'],
            foward_port_start=_config_para['foward_port_start'],
            foward_port_end=_config_para['foward_port_end'],
            shell_encoding=_config_para['shell_encoding'],
            lock_scale=_config_para['lock_scale'],
            lock_by=_config_para['lock_by'],
            start_wait_time=_config_para['start_wait_time'],
            status_callback=self._status_callback,
            logger=self.logger
        )

        # 启动minicap Web服务
        self.minicap_server.start_webserver()

        # 当前是否启用minicap服务的标志
        self.enable_minicap_server = _config_para['enable_minicap_on_start']

        # 启动minitouch服务
        self.minitouch_server = MiniTouchServer(
            adb_name=_config_para['adb'],
            foward_port_start=_config_para['touch_foward_port_start'],
            foward_port_end=_config_para['touch_foward_port_end'],
            shell_encoding=_config_para['shell_encoding'],
            buffer_size=_config_para['touch_buffer_size'],
            encoding=_config_para['touch_encoding'],
            start_wait_time=_config_para['touch_start_wait_time'],
            status_callback=self._status_callback,
            logger=self.logger
        )

        # 绑定SocketIO处理函数
        self.socketio_server.bind_bg_task_on_connect(
            self._checking_thread_fun, before_func=self.on_connect,
            bg_type='global'
        )
        self.socketio_server.bind_on_event('disconnect', self.server_on_disconnect)
        self.socketio_server.bind_on_event('switch_device_show', self.on_switch_device_show)
        self.socketio_server.bind_on_event('switch_minicap_enable', self.on_switch_minicap_enable)
        self.socketio_server.bind_on_event('device_control', self.on_device_control)

        # 检查线程的处理函数
        self.check_lock = threading.Lock()
        self.check_thread = None

    #############################
    # 工具函数
    #############################
    def check_device_status(self, device_name: str) -> str:
        """
        返回设备状态

        @param {str} device_name - 设备名

        @returns {str} - 设备状态，'init' - 初始化中, 'ready' - 就绪, 'ready-no-screen' - 无屏幕同步的就绪, 'error' - 处理失败, 'no-exists' - 不存在
        """
        if device_name not in self.devices.keys():
            return 'no-exists'
        else:
            return self.devices[device_name]['status']

    def get_device_app(self, device_name: str) -> AppDevice:
        """
        获取设备的AppDevice对象

        @param {str} device_name - 设备名

        @returns {AppDevice} - 设备对象
        """
        return self.devices_inner_info[device_name]['adb_obj']

    #############################
    # SocketIO处理函数
    #############################
    def server_on_disconnect(self):
        """
        客户端断开连接打印信息
        """
        self.logger.log(
            logging.DEBUG, 'server: client disconnect!'
        )

    def on_connect(self):
        """
        连接进来的处理函数
        """
        self.logger.log(
            logging.DEBUG, 'server: client[%s] connect!' % request.url
        )

        # 向连接进来的连接推送所有设备连接信息
        self.socketio_server.emit(
            'full_devices', self.devices
        )

    def on_switch_device_show(self, data):
        """
        切换设备显示位置

        @param {dict} data - 送入信息
            device_name {str} - 要切换的设备
            is_control {bool} - 是否控制台
        """
        _device_name = data['device_name']
        _is_control = data['is_control']
        _add_devices = dict()  # 要添加的设备

        # 通知客户端为初始化状态
        self.devices[_device_name]['status'] = 'init'
        self.devices[_device_name]['err_msg'] = ''
        self.devices[_device_name]['is_control'] = _is_control
        self.devices[_device_name].pop('show_size', None)
        self.devices[_device_name].pop('canvas_size', None)
        _add_devices[_device_name] = self.devices[_device_name]
        # 通知客户端变更状态
        self.logger.log(
            logging.DEBUG, 'broadcast switch device show init: %s' % str(_add_devices)
        )
        self.socketio_server.broadcast(
            'add_device', _add_devices, with_context_app=self.socketio_server.app
        )

        # 重置设备
        self.minicap_server.stop_device_server(_device_name)
        self._init_thread_fun(_device_name, True)  # 重新初始化
        _add_devices = dict()
        _add_devices[_device_name] = self.devices[_device_name]
        # 通知客户端变更状态
        self.logger.log(
            logging.DEBUG, 'broadcast switch device show finish: %s' % str(_add_devices)
        )
        self.socketio_server.broadcast(
            'add_device', _add_devices, with_context_app=self.socketio_server.app
        )

    def on_switch_minicap_enable(self, data):
        """
        当切换minicap server的启用状态时执行

        @param {dict} data - 送入信息
            enable {bool} - 启用状态
        """
        _enable = data['enable']
        if self.enable_minicap_server == _enable:
            # 没有修改状态，直接返回
            return

        # 改变状态
        self.enable_minicap_server = _enable

        # 处理已连接设备的状态
        if _enable:
            # 启用minicap，需重新初始化
            _init_status = list()  # 正在初始化的设备清单
            for _device_name in self.devices.keys():
                if self.devices[_device_name]['status'] == 'ready-no-screen':
                    self.devices[_device_name]['status'] = 'init'
                    _init_status.append(_device_name)
                    # 启动多线程，仅初始化minicap
                    _thread = threading.Thread(
                        target=self._init_thread_fun,
                        name='Thread-device[%s]-init-Running' % _device_name,
                        args=(_device_name, True)
                    )
                    _thread.setDaemon(True)
                    _thread.start()

            # 检查初始化进度
            while len(_init_status) > 0:
                _add_devices = dict()  # 要添加的设备
                for _device_name in _init_status:
                    if self.devices[_device_name]['status'] != 'init':
                        _add_devices[_device_name] = self.devices[_device_name]

                if len(_add_devices) > 0:
                    # 广播已完成的设备
                    self.logger.log(
                        logging.DEBUG, 'broadcast add finish device: %s' % str(_add_devices)
                    )
                    self.socketio_server.broadcast(
                        'add_device', _add_devices, with_context_app=self.socketio_server.app
                    )

                    # 删除已完成的设备
                    for _device_name in _add_devices.keys():
                        _init_status.remove(_device_name)

                # 避免把资源耗尽
                self.socketio_server.socketio.sleep(0.1)
        else:
            # 停用minicap, 修改设备状态，然后停止设备服务
            _add_devices = dict()  # 要添加的设备
            for _device_name in self.devices.keys():
                if self.devices[_device_name]['status'] == 'ready':
                    self.devices[_device_name]['status'] = 'ready-no-screen'
                    _add_devices[_device_name] = self.devices[_device_name]

            # 先通知客户端改变状态
            if len(_add_devices) > 0:
                self.logger.log(
                    logging.DEBUG, 'broadcast change device status to ready-no-screen: %s' % str(
                        _add_devices)
                )
                self.socketio_server.broadcast(
                    'add_device', _add_devices, with_context_app=self.socketio_server.app
                )

            # 逐个设备停用minicap
            for _device_name in self.devices.keys():
                if self.devices[_device_name]['status'] == 'ready-no-screen':
                    self.minicap_server.remove_device(_device_name)

    def on_device_control(self, data):
        """
        执行设备的控制操作

        @param {dict} data - 设备控制参数
            devices {list} - 要控制的设备清单
            type {str} - 控制类型
                minitouch - minitouch控制
                adb - adb控制
            para {dict} - 控制参数
        """
        _devices = data['devices']
        if len(_devices) == 0:
            # 没有要操作的设备
            return

        if data['type'] == 'minitouch':
            # 执行minitouch命令
            _builder = MiniTouchCmdBuilder(
                default_delay=self.config_services.para['touch_default_delay'],
                logger=self.logger
            )
            _para = data['para']
            _cmd = _para['cmd']
            if _cmd == 'down':
                _builder.down(
                    0, _para['x'], _para['y'], self.config_services.para['touch_default_pressure']
                )
            elif _cmd == 'up':
                _builder.up(0)
            elif _cmd == 'move':
                _builder.move(
                    0, _para['x'], _para['y'], self.config_services.para['touch_default_pressure']
                )
            else:
                # 不支持的命令，不处理
                self.logger.error(
                    'get unsupport minitouch cmd: %s' % str(_para)
                )
                return

            # 执行命令
            self.minitouch_server.publish_cmd(
                _devices, _builder
            )
        else:
            # 执行设备操作命令
            _para = data['para']
            _cmd = _para['cmd']
            if _cmd == 'swipe':
                # 使用minitouch的方式执行滑动
                _duration = _para.get('duration', 100)
                _smooth_step = _para.get('smooth_step', 20)
                if _para['direct'] == 'up':
                    self.minitouch_server.swipe_up(
                        _devices, duration=_duration, smooth_step=_smooth_step
                    )
                elif _para['direct'] == 'down':
                    self.minitouch_server.swipe_down(
                        _devices, duration=_duration, smooth_step=_smooth_step
                    )
                elif _para['direct'] == 'left':
                    self.minitouch_server.swipe_left(
                        _devices, duration=_duration, smooth_step=_smooth_step
                    )
                elif _para['direct'] == 'right':
                    self.minitouch_server.swipe_right(
                        _devices, duration=_duration, smooth_step=_smooth_step
                    )
                # 完成执行
                return

            if _cmd not in ('powerOn', 'powerOff', 'pressKey', 'screenStayOnUsb'):
                # 不支持的命令，不处理
                self.logger.error(
                    'get unsupport adb cmd: %s' % str(_para)
                )
                return

            # 遍历发送命令(未来可以改为多线程)
            for _device_name in _devices:
                _adb_control: AppDevice = self.devices_inner_info[_device_name]['adb_obj']

                if _cmd == 'powerOn':
                    # 启动电源
                    if not _adb_control.is_power_on():
                        _adb_control.press_keycode(EnumAndroidKeycode.POWER)
                elif _cmd == 'powerOff':
                    # 关闭电源
                    if _adb_control.is_power_on():
                        _adb_control.press_keycode(EnumAndroidKeycode.POWER)
                elif _cmd == 'pressKey':
                    # 按某个按键
                    _adb_control.press_keycode(_para['keycode'])
                elif _cmd == 'screenStayOnUsb':
                    # 设置连接USB屏幕常亮
                    _adb_control.set_power_stayon('usb')

    #############################
    # 内部函数
    #############################

    def _status_callback(self, device_name: str, status: str, msg: str):
        """
        设备状态调整的回调函数

        @param {str} device_name - 设备名
        @param {str} status - 设备状态 stop/error
        @param {str} msg - 错误信息
        """
        _status = 'error' if status not in ('ready', 'ready-no-screen', 'init') else status
        if device_name in self.devices.keys():
            self.change_status_devices[device_name] = {
                'change_type': 'status',
                'status': _status,
                'err_msg': msg
            }

    def _checking_thread_fun(self):
        """
        设备检查线程
        """
        while True:
            try:
                # 变更设备状态
                _add_devices = dict()  # 要添加的设备
                _change_device_nick_name = dict()  # 要修改昵称的设备
                if len(self.change_status_devices) > 0:
                    for _device_name in list(self.change_status_devices.keys()):
                        # 变更状态
                        _info = self.change_status_devices.pop(_device_name)
                        _change_type = _info.get('change_type', 'status')
                        if _change_type == 'status':
                            self.devices[_device_name]['status'] = _info.get('status', 'error')
                            self.devices[_device_name]['err_msg'] = _info.get('err_msg', '')
                            _add_devices[_device_name] = self.devices[_device_name]
                        elif _change_type == 'nick_name':
                            self.devices[_device_name]['nick_name'] = _info.get(
                                'nick_name', self.devices[_device_name]['nick_name']
                            )
                            _change_device_nick_name[_device_name] = self.devices[_device_name]

                    if len(_add_devices) > 0:
                        # 通知客户端变更状态
                        self.logger.log(
                            logging.DEBUG, 'broadcast change device status: %s' % str(_add_devices)
                        )
                        self.socketio_server.broadcast(
                            'add_device', _add_devices, with_context_app=self.socketio_server.app
                        )

                    if len(_change_device_nick_name) > 0:
                        # 通知客户端修改昵称
                        self.logger.log(
                            logging.DEBUG, 'broadcast change device nick_name: %s' % str(
                                _change_device_nick_name)
                        )
                        self.socketio_server.broadcast(
                            'change_device_nick_name', _change_device_nick_name, with_context_app=self.socketio_server.app
                        )

                # 检测新设备
                _devices = self._get_connected_devices()
                if len(_devices) == 0:
                    # 没有找到新的设备
                    self.socketio_server.socketio.sleep(1)
                    continue

                # 先通知客户端该设备正在初始化
                _init_status = list()  # 正在初始化的设备清单
                _add_devices = dict()  # 要添加的设备
                for _device_name in _devices.keys():
                    # 设备信息
                    self.devices[_device_name] = _devices[_device_name]
                    self.devices[_device_name]['status'] = 'init'
                    self.devices[_device_name]['err_msg'] = ''
                    self.devices[_device_name]['is_control'] = False  # 接入都是非控制端
                    self.devices[_device_name]['nick_name'] = self.config_services._get_db_nick_name(
                        _device_name
                    )

                    # 内部设备的信息
                    self.devices_inner_info[_device_name] = dict()
                    self.devices_inner_info[_device_name]['adb_obj'] = AppDevice(
                        desired_caps={'deviceName': _device_name},
                        shell_encoding=self.config_services.para['shell_encoding'],
                        adb_name=self.config_services.para['adb']
                    )

                    _add_devices[_device_name] = self.devices[_device_name]
                    _init_status.append(_device_name)

                # 通知客户端增加设备
                self.logger.log(
                    logging.DEBUG, 'broadcast add init device: %s' % str(_add_devices)
                )
                self.socketio_server.broadcast(
                    'add_device', _add_devices, with_context_app=self.socketio_server.app
                )

                # 启动多线程初始化设备
                for _device_name in _init_status:
                    _thread = threading.Thread(
                        target=self._init_thread_fun,
                        name='Thread-device[%s]-init-Running' % _device_name,
                        args=(_device_name, False)
                    )
                    _thread.setDaemon(True)
                    _thread.start()

                # 检查初始化进度
                while len(_init_status) > 0:
                    _add_devices = dict()  # 要添加的设备
                    for _device_name in _init_status:
                        if self.devices[_device_name]['status'] != 'init':
                            _add_devices[_device_name] = self.devices[_device_name]

                    if len(_add_devices) > 0:
                        # 广播已完成的设备
                        self.logger.log(
                            logging.DEBUG, 'broadcast add finish device: %s' % str(_add_devices)
                        )
                        self.socketio_server.broadcast(
                            'add_device', _add_devices, with_context_app=self.socketio_server.app
                        )

                        # 删除已完成的设备
                        for _device_name in _add_devices.keys():
                            _init_status.remove(_device_name)

                    # 避免把资源耗尽
                    self.socketio_server.socketio.sleep(0.1)

            except:
                self.logger.log(
                    logging.ERROR,
                    '[EX: device checking exception]%s' % traceback.format_exc(),
                )

            # 睡眠一段时间
            self.socketio_server.socketio.sleep(1)  # 必须使用这个睡眠方法，才不会阻塞

    def _init_thread_fun(self, device_name: str, only_minicap):
        """
        初始化设备的线程

        @param {str} device_name - 要初始化的设备名
        @param {bool} only_minicap - 是否仅处理minicap
        """
        # 执行初始化
        try:
            if not only_minicap:
                # 初始化minitouch服务
                self.minitouch_server.init_device_server(
                    device_name, self.config_services.shared_path,
                    adb_name=self.config_services.para['adb'],
                    shell_encoding=self.config_services.para['shell_encoding']
                )

                # 启动minitouch服务
                self.minitouch_server.start_device_server(
                    device_name
                )

                # 初始化设备ADB安装
                self.devices_inner_info[device_name]['adb_obj'].init_device()

            # 初始化minicap服务
            self.minicap_server.init_device_server(
                device_name, self.config_services.shared_path,
                adb_name=self.config_services.para['adb'],
                shell_encoding=self.config_services.para['shell_encoding']
            )

            # 启动minicap服务
            if self.minicap_server.webserver_thread is not None:
                # web 服务启动成功的情况
                if self.devices[device_name]['is_control']:
                    _canvas_size = (
                        self.config_services.para['control_canvas_width'],
                        self.config_services.para['control_canvas_height']
                    )
                    _show_size = (
                        self.config_services.para['control_width'],
                        self.config_services.para['control_height']
                    )
                else:
                    _canvas_size = (
                        self.config_services.para['list_canvas_width'],
                        self.config_services.para['list_canvas_height']
                    )
                    _show_size = (
                        self.config_services.para['list_width'],
                        self.config_services.para['list_height']
                    )

                if self.enable_minicap_server:
                    # 启动服务
                    _minicap_info = self.minicap_server.start_device_server(
                        device_name, show_size=_show_size, canvas_size=_canvas_size,
                        orientation=self.config_services.para['orientation'],
                        quality=self.config_services.para['quality']
                    )

                    # 更新设备所需信息
                    self.devices[device_name]['port'] = _minicap_info['port']
                    self.devices[device_name]['real_size'] = _minicap_info['real_size']
                    self.devices[device_name]['show_size'] = _minicap_info['show_size']
                    self.devices[device_name]['canvas_size'] = _minicap_info['canvas_size']
                    self.devices[device_name]['status'] = 'ready'
                else:
                    # 不启动屏幕同步
                    _real_size = self.minicap_server.get_screen_wm(
                        device_name, adb_name=self.config_services.para['adb'],
                        shell_encoding=self.config_services.para['shell_encoding']
                    )
                    _canvas_size = self.minicap_server.get_show_size(
                        _real_size, _canvas_size
                    )
                    _show_size = self.minicap_server.get_show_size(
                        _real_size, _show_size
                    )
                    self.devices[device_name]['real_size'] = _real_size
                    self.devices[device_name]['show_size'] = _show_size
                    self.devices[device_name]['canvas_size'] = _canvas_size
                    self.devices[device_name]['status'] = 'ready-no-screen'
            else:
                # minicap web 服务启动失败
                self.devices[device_name]['status'] = 'error'
                self.devices[device_name]['err_msg'] = 'minicap server not started!'
        except:
            # 更新状态信息
            _err_msg = traceback.format_exc()
            self.devices[device_name]['status'] = 'error'
            self.devices[device_name]['err_msg'] = _err_msg
            self.logger.log(
                logging.ERROR,
                '[EX: device %s init exception]%s' % (
                    device_name, _err_msg
                ),
            )

    #############################
    # ADB相关公共函数
    #############################

    def _get_connected_devices(self) -> dict:
        """
        获取已经连接上且未展示的设备清单字典

        @returns {dict} - 设备清单字典
            {
                '设备名称': {
                    ...
                },
                ...
            }
        """
        _adb = self.config_services.para['adb']
        _devices = dict()
        _full_device_list = list()
        _cmd_info = AdbTools.adb_run(_adb, '', 'devices -l')

        for _str in _cmd_info:
            if not _str.startswith('List of'):
                # 找到设备连接号
                _device_name = (_str[0: _str.find(' ')]).strip()

                if _device_name == '':
                    # 非法数据或已连接，不处理
                    continue

                # 登记完整清单
                _full_device_list.append(_device_name)

                if _device_name in self.devices.keys() and self.devices[_device_name]['status'] != 'error':
                    # 设备已存在，不处理
                    continue

                # 获取设备信息
                _devices[_device_name] = self._get_device_info(_device_name)

        # 检查是否有设备掉线
        _current_devices = list(self.devices.keys())
        for _device_name in _current_devices:
            if _device_name not in _full_device_list:
                # 设备已掉线
                self.remove_unconnect_device(_device_name)

        # 返回结果字典
        return _devices

    def _get_device_info(self, device_name: str) -> dict:
        """
        获取设备信息

        @param {str} device_name - 设备名称（注意需已连接adb）

        @returns {dict} - 设备信息字典, 注意如果没有连接上也能正常返回，只是相应key值不存在
            {
                'device_name': '',  # 设备名称
                'platform_name': 'Android',  # 手机平台名
                'platform_version': '',  # 手机平台版本
                'wlan_ip': '',  # 手机连接的 wifi ip
                'brand': '',  # 手机的品牌
                'model': ''  # 手机的产品名称
            }
        """
        _device_info = {
            'device_name': device_name,
            'platform_name': 'Android'
        }
        _adb = self.config_services.para['adb']
        _shell_encoding = self.config_services.para['shell_encoding']
        # 获取版本
        _device_info['platform_version'] = ''
        try:
            _cmd_info = AdbTools.adb_run(
                _adb, device_name, 'shell getprop ro.build.version.release',
                shell_encoding=_shell_encoding
            )
            _device_info['platform_version'] = _cmd_info[0]
        except:
            pass

        # 获取手机厂商品牌
        _device_info['brand'] = ''
        try:
            _cmd_info = AdbTools.adb_run(
                _adb, device_name, 'shell getprop ro.product.brand',
                shell_encoding=_shell_encoding
            )
            _device_info['brand'] = _cmd_info[0]
        except:
            pass

        # 获取手机产品名称
        _device_info['model'] = ''
        try:
            _cmd_info = AdbTools.adb_run(
                _adb, device_name, 'shell getprop ro.product.model',
                shell_encoding=_shell_encoding
            )
            _device_info['model'] = _cmd_info[0]
        except:
            pass

        # 获取WIFI地址
        _device_info['wlan_ip'] = ''
        try:
            _cmd_info = AdbTools.adb_run(
                _adb, device_name, 'shell ifconfig wlan0',
                shell_encoding=_shell_encoding
            )
            for _line in _cmd_info:
                _line = _line.strip()
                if _line.startswith('inet addr:'):
                    _temp_len = len('inet addr:')
                    _device_info['wlan_ip'] = _line[_temp_len: _line.find(' ', _temp_len)]
                    break
        except:
            pass

        return _device_info

    def remove_unconnect_device(self, device_name: str):
        """
        移除已掉线设备

        @param {str} device_name - 设备号
        """
        # 删除minitouch服务
        self.minitouch_server.remove_device(device_name)

        # 删除minicap服务
        self.minicap_server.remove_device(device_name)

        # 再删除自己的信息
        self.devices.pop(device_name, None)
        self.devices_inner_info.pop(device_name, None)

        # 通知所有客户端
        self.logger.log(
            logging.DEBUG, 'broadcast remove finish device: %s' % device_name
        )
        self.socketio_server.broadcast(
            'remove_device', {'device': device_name}, with_context_app=self.socketio_server.app
        )


if __name__ == '__main__':
    # 当程序自己独立运行时执行的操作
    # 打印版本信息
    print(('模块名：%s  -  %s\n'
           '作者：%s\n'
           '发布日期：%s\n'
           '版本：%s' % (__MOUDLE__, __DESCRIPT__, __AUTHOR__, __PUBLISH__, __VERSION__)))
