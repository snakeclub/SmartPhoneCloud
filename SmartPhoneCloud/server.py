#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
# Copyright 2019 黎慧剑
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""
智能手机云控后台服务
@module server
@file server.py
"""

import os
import sys
if sys.platform == 'win32':
    import win32com.client
from HiveNetLib.base_tools.run_tool import RunTool
import HiveNetLib.simple_log as simple_log
from HiveNetLib.simple_restful.server import FlaskServer
from HiveNetLib.simple_restful.socketio import SocketIOServer
# 根据当前文件路径将包路径纳入，在非安装的情况下可以引用到
sys.path.append(os.path.abspath(os.path.join(
    os.path.dirname(__file__), os.path.pardir)))
from SmartPhoneCloud.lib.bg_services import ConfigServices, DeviceServices
from SmartPhoneCloud.lib.plugin import PluginManager


def run_server(**kwargs):
    """
    运行群控后台服务
    """
    # 基本参数
    _root_path = os.path.abspath(os.path.dirname(__file__))
    _static_folder = 'website'
    _template_folder = 'templates'

    # 日志对象
    _logger = simple_log.Logger(
        conf_file_name=os.path.join(_root_path, 'config/logger.json'),
        logger_name=simple_log.EnumLoggerName.ConsoleAndFile,
        config_type=simple_log.EnumLoggerConfigType.JSON_FILE,
        logfile_path=os.path.join(_root_path, 'log/server.log'),
        is_create_logfile_by_day=True
    )

    # 实例化服务对象
    _config_services = ConfigServices(logger=_logger)
    RunTool.set_global_var('CONFIG_SERVICES', _config_services)  # 添加到全局变量

    # 初始化SocketIoServer
    _socketio_config = {
        'app_config': {},
        'flask_run': {
            'host': _config_services.para['socketio_host'],
            'port': _config_services.para['socketio_port'],
        },
        'socketio_config': {
            'cors_allowed_origins': '*'  # 解决跨域访问问题
        },
        'json_as_ascii': _config_services.para['socketio_json_as_ascii']
    }

    _socketio_server = SocketIOServer(
        'smartphone_socketio_server', server_config=_socketio_config, logger=_logger
    )
    RunTool.set_global_var('SOCKETIO_SERVER', _socketio_server)  # 添加到全局变量

    # 设备服务
    _device_services = DeviceServices(
        config_services=_config_services,
        socketio_server=_socketio_server,
        logger=_logger
    )
    RunTool.set_global_var('DEVICE_SERVICES', _device_services)  # 添加到全局变量

    # 创建网站快捷方式
    if sys.platform == 'win32':
        _ws = win32com.client.Dispatch("wscript.shell")
        _scut = _ws.CreateShortcut(
            os.path.join(_root_path, '群控管理后台.url')
        )
        _scut.TargetPath = 'http://%s:%d/' % (
            _config_services.para['site'], _config_services.para['port']
        )
        _scut.Save()

    # 初始化FlaskServer
    _server_config = {
        'app_config': {
            'root_path': _root_path,
            'static_folder': _static_folder,
            'static_url_path': '',
            'template_folder': _template_folder,
        },
        'flask_run': {
            'host': _config_services.para['host'],
            'port': _config_services.para['port'],
            'threaded': _config_services.para['threaded'],
            'processes': _config_services.para['processes']
        },
        'json_as_ascii': _config_services.para['json_as_ascii'],
        'use_wsgi': _config_services.para['use_wsgi'],
        'send_file_max_age_default': 1,  # 缓存一秒过期
    }
    _server = FlaskServer(
        'smartphone_clound_server', server_config=_server_config, logger=_logger
    )
    RunTool.set_global_var('FLASK_SERVER', _server)  # 添加到全局变量

    # 装载Restful Api, 设备管理走socketio模式
    _server.add_route_by_class(
        [_config_services],
        blacklist=[
            'ConfigServices/index',
        ]
    )

    # 改变主页的路由
    _server.add_route('/', _config_services.index)
    _server.app.jinja_env.auto_reload = True  # 设置模板变更后立即生效

    # 插件管理器
    _plugin_manager = PluginManager(
        _config_services, _device_services, _server,
        config_path=_config_services.config_path, always_update=True,
        logger=_logger
    )
    RunTool.set_global_var('PLUGIN_MANAGER', _plugin_manager)  # 添加到全局变量

    # 启动SocketIOServer, 异步启动模式
    _socketio_server.start(is_asyn=True)

    # 启动FlaskServer
    _server.start()


if __name__ == '__main__':
    # 当程序自己独立运行时执行的操作
    run_server()
