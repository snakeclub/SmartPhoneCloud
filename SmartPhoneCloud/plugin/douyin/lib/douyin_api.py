#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
# Copyright 2019 黎慧剑
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""
抖音直播间控制后台模块

@module douyin_api
@file douyin_api.py
"""

import os
import sys
import logging
import json
import time
import math
import re
import copy
import random
import threading
import sqlite3
import traceback
import subprocess
from flask import request
from appium.webdriver.common.mobileby import MobileBy
from HiveNetLib.simple_restful.server import FlaskTool, FlaskServer
from HandLessRobot.lib.controls.adb_control import AdbTools, AppDevice, AppElement
# 根据当前文件路径将包路径纳入，在非安装的情况下可以引用到
sys.path.append(os.path.abspath(os.path.join(
    os.path.dirname(__file__), os.path.pardir, os.path.pardir, os.path.pardir, os.path.pardir)))


__MOUDLE__ = 'douyin_api'  # 模块名
__DESCRIPT__ = u'抖音直播间控制后台模块'  # 模块描述
__VERSION__ = '0.1.0'  # 版本
__AUTHOR__ = u'黎慧剑'  # 作者
__PUBLISH__ = '2020.12.11'  # 发布日期


class DyControlApi(object):
    """
    抖音后台控制Api接口
    """

    #############################
    # 构造函数
    #############################
    def __init__(self, **kwargs):
        """
        抖音后台控制Api接口

        @param {ConfigServices} config_services - 框架的配置服务对象
        @param {DeviceServices} device_services - 框架的设备服务对象
        @param {str} config_path - 配置文件所在目录(sqlite文件)
        @param {str} plugin_path - 插件所在目录
        @param {Logger} logger - 日志对象
        """
        # 配置信息
        self.kwargs = kwargs
        self.config_services = self.kwargs['config_services']
        self.device_services = self.kwargs['device_services']
        self.config_path = self.kwargs['config_path']
        self.plugin_path = self.kwargs['plugin_path']
        self.logger = self.kwargs.get('logger', None)
        if self.logger is None:
            self.logger = logging.getLogger()

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
        self._exec_sql(
            'create table if not exists t_bg_para(p_name varchar(30) primary key, p_type varchar(30), p_value varchar(500))'
        )  # 后台参数表

        # 获取系统初始化参数
        _fetchs = self._exec_sql('select * from t_para', is_fetchall=True)
        self.para = {
            # 应用自动化参数
            'auto_into_line': False,  # 自动进入直播间
            'into_line_err_exit': False,  # 自动进入直播间失败退出
            'is_into_wait': True,  # 批量进入直播间是否随机间隔时长（防风控）
            'into_line_wait_min': 0.5,  # 批量进入直播间间隔最小时长
            'into_line_wait_max': 2.0,  # 批量进入直播间间隔最大时长
            # 通用控制设置
            'implicitly_wait': 5.0,  # 查找元素最长等待时间
            'android_restore_ime': 'bufan.bfime/.xIME',  # 多控统一恢复输入法
            # 安卓控制参数 - 启动
            'android_apk': 'ADBKeyboard.apk',  # 安装apk，放在 config 目录中
            'android_appPackage': 'com.ss.android.ugc.aweme',  # 抖音应用
            'android_appActivity': '.splash.SplashActivity',  # 抖音首页
            'android_line_appActivity': '.live.LivePlayActivity|.detail.ui.LiveDetailActivity',  # 抖音直播页面
            # 安卓控制参数 - 脚本
            'android_chat_wait_input': 1,  # 等待输入框弹出的时间
            'android_script_file': "aweme_script.json",
            # 点赞设置参数
            'give_thumbs_up_offset_x': 0.01,  # 点赞操作从屏幕中心偏移比例(可以为负数)
            'give_thumbs_up_offset_y': 0.01,  # 点赞操作从屏幕中心偏移比例(可以为负数)
            'give_thumbs_up_random_x': 0.01,  # 点赞操作点击点的随机位置范围大小
            'give_thumbs_up_random_y': 0.01,  # 点赞操作点击点的随机位置范围大小
            'give_thumbs_up_random_seed': 5,  # 点赞操作点击点的随机位置种子数量
            # 'give_thumbs_up_tap_max': 5,  # 点赞操作每次命令点击次数上限
            'give_thumbs_up_tap_random': True,  # 点赞操作是否每次随机点击次数
            'give_thumbs_up_random_wait': True,  # 点赞点击之间是否随机等待时长
            'give_thumbs_up_wait_min': 0.0,  # 点赞点击之间是否随机最小时长
            'give_thumbs_up_wait_max': 0.5,  # 点赞点击之间是否随机最大时长
        }  # 默认值
        self._dbrows_to_para(_fetchs, self.para)
        # 刷新回数据库
        self._update_db_para(self.para, 't_para')

        # 获取后台初始化参数
        _fetchs = self._exec_sql('select * from t_bg_para', is_fetchall=True)
        self.bg_para = {
            'line_name': '直播间',  # 直播间名
            'send_bt_wait_min': 0.5,  # 多人操作间隔最小时长
            'send_bt_wait_max': 2.0,  # 多人操作间隔最大时长
            'give_thumbs_self_define': 20,  # 自定义点赞时长(秒)
            'tap_to_main': '0.5,0.25',  # 点击屏幕
        }
        self._dbrows_to_para(_fetchs, self.bg_para)
        # 刷新回数据库
        self._update_db_para(self.bg_para, 't_bg_para')

        # 加载脚本
        self._android_script = dict()  # 安卓的脚本配置字典
        self._load_android_script()  # 加载脚本文件

        # 设备连接应用的映射字典, key 为 device_name, value 为连接信息字典
        # app - 设备连接上的 AppDevice 对象
        # app_package - 当前连接的应用包名
        # activit_type - 连接页面的类型, line - 直播, user_name - 用户名称
        self.apps = dict()

        # 批量任务处理交互临时字典, 格式为
        # {
        #     interface_id: {
        #         device_name: {
        #             'type': '',  # 任务类型
        #             'para': obj, # 执行任务参数
        #             'is_success': False,  # 是否执行成功
        #             'msg': ''  # 结果信息
        #         },
        #         ...
        #     },
        #     ...
        # }
        self._batch_task = dict()
        # 批量任务执行的函数映射, key 为 type, value 为执行函数对象
        self._batch_fun_mapping = {
            'into_app_line': self._into_app_line_batch_fun,
            'app_send_chat': self._app_send_chat_batch_fun,
            'app_send_heart': self._app_send_heart_batch_fun,
            'app_click_car': self._app_click_car_batch_fun,
            'app_give_thumbs_up': self._app_give_thumbs_up_batch_fun,
            'app_tap_screen': self._app_tap_screen_batch_fun,
        }

    #############################
    # API - config配置
    #############################
    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def get_config(self, methods=['POST'], **kwargs):
        """
        获取系统配置

        @api {post} {json} /api/DyControlApi/get_config get_config
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

        @api {post} {json} /api/DyControlApi/set_config set_config
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
    def get_bg_config(self, methods=['POST'], **kwargs):
        """
        后去后台配置

        @api {post} {json} /api/DyControlApi/get_bg_config get_bg_config
        @body-in {str} interface_id - 接口id

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
            ...
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
            _resp.update(self.bg_para)
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
    def set_bg_config(self, methods=['POST'], **kwargs):
        """
        更新系统配置

        @api {post} {json} /api/DyControlApi/set_bg_config set_bg_config
        @body-in {str} interface_id - 接口id
        ...

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
            self.bg_para.update(_para)
            self._update_db_para(self.bg_para, 't_bg_para')
            # 重置mapping
            self._load_script_version_mapping()
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
    # ADB相关操作
    #############################
    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def install_app(self, methods=['POST'], **kwargs):
        """
        向设备安装App

        @api {post} {json} /api/DyControlApi/install_app install_app
        @body-in {str} interface_id - 接口id
        @body-in {str} device_name - 设备名

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
            _device_name = request.json['device_name']
            if _device_name in self.apps.keys():
                raise RuntimeError('设备[%s]正被控制中, 请先关闭直播或等待控制结束！' % _device_name)

            # 安装设备
            self._install_app(_device_name)
            _resp['msg'] = '设备[%s]的App应用安装成功!' % _device_name

            # 返回结果
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
    def restore_ime(self, methods=['POST'], **kwargs):
        """
        恢复设备输入法

        @api {post} {json} /api/DyControlApi/restore_ime restore_ime
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 连接失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _resp = {
            'interface_id': request.json.get('interface_id', ''),
            'status': '00000',
            'msg': '成功',
            'error_info': list()
        }
        try:
            for _device_name in request.json.get('devices', []):
                # 逐个进行处理
                _status = self.device_services.check_device_status(_device_name)
                if _status not in ('ready', 'ready-no-screen'):
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': '设备未连接或连接失败'
                    })
                    continue

                # 进行输入法的恢复处理
                try:
                    # 变更输入法
                    _app: AppDevice = self.device_services.get_device_app(_device_name)
                    _app.set_default_ime(self.para['android_restore_ime'])
                except Exception as e:
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': str(e)
                    })

            # 返回结果
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
    # 手机控制，抖音APP操作
    #############################
    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def get_online_devices(self, methods=['POST'], **kwargs):
        """
        获取已连接的设备清单

        @api {post} {json} /api/DyControlApi/get_online_devices get_online_devices
        @body-in {str} interface_id - 接口id

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} devices - 已连接的设备名清单
            ['device_name', 'xx', 'xx', ...]
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
            _resp['devices'] = list()

            # 刷新状态
            for _device_name in self.apps.keys():
                if self.apps[_device_name]['activit_type'] == 'line':
                    # 启动app的类型是直播
                    _resp['devices'].append(_device_name)

            # 返回结果
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
    def get_app_user(self, methods=['POST'], **kwargs):
        """
        获取抖音用户名

        @api {post} {json} /api/DyControlApi/get_app_user get_app_user
        @body-in {str} interface_id - 接口id
        @body-in {str} device_name - 设备名

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {str} user_name - 抖音用户名, 如果获取不到返回 ''
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _resp = {
            'interface_id': request.json.get('interface_id', ''),
            'status': '00000',
            'msg': '成功',
            'user_name': ''
        }
        try:
            _device_name = request.json['device_name']
            _resp['user_name'] = self._get_app_user(_device_name)

            # 返回结果
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
    def into_app_line(self, methods=['POST'], **kwargs):
        """
        指定设备进入直播间

        @api {post} {json} /api/DyControlApi/into_app_line into_app_line
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 进入失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        @body-out {list} warning_info - 启动成功但自动进入直播间失败的情况
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _interface_id = request.json.get('interface_id', '')
        _resp = {
            'interface_id': _interface_id,
            'status': '00000',
            'msg': '成功',
            'error_info': list(),
            'warning_info': list()
        }
        try:
            # 生成批量任务字典
            self._batch_task[_interface_id] = dict()

            # 逐个进行进入直播间处理
            for _device_name in request.json.get('devices', []):
                _status = self.device_services.check_device_status(_device_name)
                if _status not in ('ready', 'ready-no-screen'):
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': '设备未连接或连接失败'
                    })
                    continue

                # 添加到批量任务
                self._batch_task[_interface_id][_device_name] = {
                    'type': 'into_app_line',
                    'para': None
                }

            # 执行批量任务
            self._run_batch_task(
                _interface_id, run_bt_wait=self.para['is_into_wait'],
                min_wait_time=self.para['into_line_wait_min'],
                max_wait_time=self.para['into_line_wait_max']
            )

            # 检查执行结果
            for _device_name in self._batch_task[_interface_id].keys():
                if not self._batch_task[_interface_id][_device_name]['is_success']:
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': self._batch_task[_interface_id][_device_name]['msg']
                    })
                    continue
                elif self._batch_task[_interface_id][_device_name]['msg'] != '成功':
                    # 启动成功, 但是自动进入失败
                    _resp['warning_info'].append({
                        'device_name': _device_name,
                        'error': self._batch_task[_interface_id][_device_name]['msg']
                    })

            # 返回结果
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
        finally:
            # 删除临时任务清单
            self._batch_task.pop(_interface_id, None)

    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def out_app_line(self, methods=['POST'], **kwargs):
        """
        退出直播间

        @api {post} {json} /api/DyControlApi/out_app_line out_app_line
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 断开连接失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _resp = {
            'interface_id': request.json.get('interface_id', ''),
            'status': '00000',
            'msg': '成功',
            'error_info': list()
        }
        try:
            for _device_name in request.json.get('devices', []):
                # 逐个进行退出直播间处理
                if _device_name in self.apps.keys():
                    self._close_app(_device_name)

            # 返回结果
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
    def app_send_chat(self, methods=['POST'], **kwargs):
        """
        发送聊天文本

        @api {post} {json} /api/DyControlApi/into_app_line into_app_line
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]
        @body-in {str} text - 要发送的文本
        @body-in {bool} wait_bt_device - 多人操作是否间隔时间

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 发送失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        # _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _interface_id = request.json.get('interface_id', '')
        _resp = {
            'interface_id': _interface_id,
            'status': '00000',
            'msg': '成功',
            'error_info': list()
        }
        try:
            # 生成批量任务字典
            self._batch_task[_interface_id] = dict()

            # 逐个设备进行处理
            for _device_name in request.json.get('devices', []):
                if _device_name not in self.apps.keys():
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': '设备未进入直播间'
                    })
                    continue

                self._batch_task[_interface_id][_device_name] = {
                    'type': 'app_send_chat',
                    'para': request.json['text']
                }

            # 执行批量任务
            self._run_batch_task(
                _interface_id, run_bt_wait=request.json['wait_bt_device'],
                min_wait_time=self.bg_para['send_bt_wait_min'],
                max_wait_time=self.bg_para['send_bt_wait_max']
            )

            # 检查执行结果
            for _device_name in self._batch_task[_interface_id].keys():
                if not self._batch_task[_interface_id][_device_name]['is_success']:
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': self._batch_task[_interface_id][_device_name]['msg']
                    })

            # 返回结果
            return _resp
        except Exception as e:
            _resp['status'] = '21599'
            _resp['msg'] = str(e)
            if _logger is not None:
                _logger.log(
                    logging.ERROR,
                    '[EX][interface_id:%s]%s' % (_resp['interface_id'], traceback.format_exc()),
                    extra=_logger_extra
                )
            return _resp
        finally:
            # 删除临时任务清单
            self._batch_task.pop(_interface_id, None)

    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def app_send_heart(self, methods=['POST'], **kwargs):
        """
        送小心心

        @api {post} {json} /api/DyControlApi/app_send_heart app_send_heart
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]
        @body-in {bool} wait_bt_device - 多人操作是否间隔时间

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 发送失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _interface_id = request.json.get('interface_id', '')
        _resp = {
            'interface_id': _interface_id,
            'status': '00000',
            'msg': '成功',
            'error_info': list()
        }
        try:
            # 生成批量任务字典
            self._batch_task[_interface_id] = dict()

            # 逐个设备进行处理
            for _device_name in request.json.get('devices', []):
                if _device_name not in self.apps.keys():
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': '设备未进入直播间'
                    })
                    continue

                self._batch_task[_interface_id][_device_name] = {
                    'type': 'app_send_heart',
                    'para': None
                }

            # 执行批量任务
            self._run_batch_task(
                _interface_id, run_bt_wait=request.json['wait_bt_device'],
                min_wait_time=self.bg_para['send_bt_wait_min'],
                max_wait_time=self.bg_para['send_bt_wait_max']
            )

            # 检查执行结果
            for _device_name in self._batch_task[_interface_id].keys():
                if not self._batch_task[_interface_id][_device_name]['is_success']:
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': self._batch_task[_interface_id][_device_name]['msg']
                    })

            # 返回结果
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
        finally:
            # 删除临时任务清单
            self._batch_task.pop(_interface_id, None)

    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def app_click_car(self, methods=['POST'], **kwargs):
        """
        点击购物车

        @api {post} {json} /api/DyControlApi/app_send_heart app_send_heart
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]
        @body-in {bool} wait_bt_device - 多人操作是否间隔时间

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 发送失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _interface_id = request.json.get('interface_id', '')
        _resp = {
            'interface_id': _interface_id,
            'status': '00000',
            'msg': '成功',
            'error_info': list()
        }
        try:
            # 生成批量任务字典
            self._batch_task[_interface_id] = dict()

            # 逐个设备进行处理
            for _device_name in request.json.get('devices', []):
                if _device_name not in self.apps.keys():
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': '设备未进入直播间'
                    })
                    continue

                self._batch_task[_interface_id][_device_name] = {
                    'type': 'app_click_car',
                    'para': None
                }

            # 执行批量任务
            self._run_batch_task(
                _interface_id, run_bt_wait=request.json['wait_bt_device'],
                min_wait_time=self.bg_para['send_bt_wait_min'],
                max_wait_time=self.bg_para['send_bt_wait_max']
            )

            # 检查执行结果
            for _device_name in self._batch_task[_interface_id].keys():
                if not self._batch_task[_interface_id][_device_name]['is_success']:
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': self._batch_task[_interface_id][_device_name]['msg']
                    })

            # 返回结果
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
        finally:
            # 删除临时任务清单
            self._batch_task.pop(_interface_id, None)

    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def app_give_thumbs_up(self, methods=['POST'], **kwargs):
        """
        点赞

        @api {post} {json} /api/DyControlApi/app_give_thumbs_up app_give_thumbs_up
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]
        @body-in {bool} wait_bt_device - 多人操作是否间隔时间
        @body-in {float} seconds - 要点赞的时长，单位为秒

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 发送失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _interface_id = request.json.get('interface_id', '')
        _resp = {
            'interface_id': _interface_id,
            'status': '00000',
            'msg': '成功',
            'error_info': list()
        }
        try:
            # 生成批量任务字典
            self._batch_task[_interface_id] = dict()

            # 逐个设备进行处理
            for _device_name in request.json.get('devices', []):
                if _device_name not in self.apps.keys():
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': '设备未进入直播间'
                    })
                    continue

                self._batch_task[_interface_id][_device_name] = {
                    'type': 'app_give_thumbs_up',
                    'para': request.json.get('seconds', 5.0)
                }

            # 执行批量任务
            self._run_batch_task(
                _interface_id, run_bt_wait=request.json['wait_bt_device'],
                min_wait_time=self.bg_para['send_bt_wait_min'],
                max_wait_time=self.bg_para['send_bt_wait_max']
            )

            # 检查执行结果
            for _device_name in self._batch_task[_interface_id].keys():
                if not self._batch_task[_interface_id][_device_name]['is_success']:
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': self._batch_task[_interface_id][_device_name]['msg']
                    })

            # 返回结果
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
        finally:
            # 删除临时任务清单
            self._batch_task.pop(_interface_id, None)

    @FlaskTool.log(get_logger_fun=FlaskServer.get_logger_fun, get_logger_para={'app_name': 'smartphone_clound_server'})
    @FlaskTool.support_object_resp
    def app_tap_screen(self, methods=['POST'], **kwargs):
        """
        点击屏幕

        @api {post} {json} /api/DyControlApi/app_tap_screen app_tap_screen
        @body-in {str} interface_id - 接口id
        @body-in {list} devices - 设备清单, ['设备名', '设备名', ...]
        @body-in {bool} wait_bt_device - 多人操作是否间隔时间

        @body-out {str} interface_id - 接口id
        @body-out {str} status - 处理状态, 定义如下
            00000 - 成功
            21599 - 应用服务处理其他失败
        @body-out {str} msg - 处理状态对应的描述
        @body-out {list} error_info - 发送失败的设备清单和失败信息
            [
                {
                    'device_name': '',
                    'error': ''
                },
                ...
            ]
        """
        # 日志对象获取
        _logger = kwargs.get('logger', None)
        _logging_level = kwargs.get('logging_level', None)
        _logger_extra = kwargs.get('logger_extra', None)

        # 设置返回的字典
        _interface_id = request.json.get('interface_id', '')
        _resp = {
            'interface_id': _interface_id,
            'status': '00000',
            'msg': '成功',
            'error_info': list()
        }
        try:
            # 生成批量任务字典
            self._batch_task[_interface_id] = dict()

            # 逐个设备进行处理
            for _device_name in request.json.get('devices', []):
                if _device_name not in self.apps.keys():
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': '设备未进入直播间'
                    })
                    continue

                self._batch_task[_interface_id][_device_name] = {
                    'type': 'app_tap_screen',
                    'para': None
                }

            # 执行批量任务
            self._run_batch_task(
                _interface_id, run_bt_wait=request.json['wait_bt_device'],
                min_wait_time=self.bg_para['send_bt_wait_min'],
                max_wait_time=self.bg_para['send_bt_wait_max']
            )

            # 检查执行结果
            for _device_name in self._batch_task[_interface_id].keys():
                if not self._batch_task[_interface_id][_device_name]['is_success']:
                    _resp['error_info'].append({
                        'device_name': _device_name,
                        'error': self._batch_task[_interface_id][_device_name]['msg']
                    })

            # 返回结果
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
        finally:
            # 删除临时任务清单
            self._batch_task.pop(_interface_id, None)

    #############################
    # 需要置为API黑名单的函数
    #############################

    #############################
    # ADB的内部处理函数
    #############################
    def _load_android_script(self):
        """
        加载脚本文件
        """
        _json_file = os.path.join(
            self.config_path, self.para['android_script_file']
        )
        with open(_json_file, 'r', encoding='utf8') as _f:
            _json = _f.read()
            _json = _json.replace('{$=直播间=$}', self.bg_para['line_name'])
            self._android_script = json.loads(_json)

    def _get_script(self, device_name: str) -> dict:
        """
        获取设备对应的脚本

        @param {str} device_name - 要获取脚本的设备

        @returns {dict} - 返回脚本配置
        """
        _info = self.device_services.devices[device_name]
        _script = copy.deepcopy(self._android_script['base'])

        # 遍历匹配条件的配置
        for _match in self._android_script['match']:
            _is_match = True
            for _info_key in _match['regular'].keys():
                _reg_match = re.match(_match['regular'][_info_key], _info[_info_key])
                if _reg_match is None:
                    _is_match = False
                    break

            if not _is_match:
                continue

            # 匹配上条件，更新脚本
            _script.update(
                copy.deepcopy(_match['script'])
            )

        # 返回处理后的脚本
        return _script

    #############################
    # 抖音控制的内部函数
    #############################
    def _install_app(self, device_name: str):
        """
        安装APP

        @param {str} device_name - 要安装到的设备号
        """
        _app: AppDevice = self.device_services.get_device_app(device_name)

        _apks = self.para['android_apk'].split(',')
        for _apk in _apks:
            if _apk == '':
                continue

            _path = os.path.abspath(
                os.path.join(self.config_path, _apk)
            )

            _app.install_app(_path)

    def _get_app_version(self, device_name: str) -> str:
        """
        获取抖音应用版本

        @param {str} device_name - 设备名

        @returns {str} - 版本号，找不到返回''
        """
        _app: AppDevice = self.device_services.get_device_app(device_name)

        _version = ''
        _para_name = 'versionName'
        _cmd = 'shell pm dump %s | %s "%s"' % (
            self.para['android_appPackage'],
            'findstr' if sys.platform == 'win32' else 'grep',
            _para_name
        )

        try:
            _back = _app.adb_run_inner(
                _cmd
            )
            _temp = _back[0].strip()
            if _temp.startswith(_para_name):
                _version = _temp[len(_para_name) + 1:]
        except:
            pass

        return _version

    def _close_app(self, device_name: str):
        """
        停止应用控制

        @param {str} device_name - 要停止的设备名
        """
        _app = self.apps.pop(device_name, None)
        if _app is not None:
            # 检查是否要恢复输入法
            if _app.get('default_ime', None) is not None:
                try:
                    _app['app'].adb_set_default_ime(_app['default_ime'])
                except:
                    pass

            # 删除应用
            _app['app'].__del__()
            del _app['app']

    def _start_app(self, device_name: str, activit_type: str):
        """
        启动APP控制

        @param {str} device_name - 设备名
        @param {str} activit_type - 页面类型
            line - 直播
            user_name - 用户名称

        @throws {RuntimeError} - App已启动或设备名不在清单，将抛出异常
        """
        # 检查当前是否允许启动
        if device_name in self.apps.keys():
            raise RuntimeError('设备[%s]正被控制中, 请先关闭直播或等待控制结束！' % device_name)

        # 启动app
        _app: AppDevice = self.device_services.get_device_app(device_name)

        # 判断是否要启动app
        if self.para['android_appPackage'] != '' and (
            _app.current_package != self.para['android_appPackage'] or _app.current_activity != self.para['android_appActivity']
        ):
            _app.launch_app(
                app_id=self.para['android_appPackage'],
                activity=self.para['android_appActivity']
            )

        # 获取设备应用版本
        _app_version = self._get_app_version(device_name)
        self.device_services.devices[device_name]['app_version'] = _app_version

        # 启动通过，加入字典
        self.apps[device_name] = {
            'app': _app,
            'app_package': self.para['android_appPackage'],
            'activit_type': activit_type,
            'app_version': _app_version,
            'script': self._get_script(device_name)
        }

    def _get_app_user(self, device_name: str) -> str:
        """
        获取抖音用户名

        @param {str} device_name - 设备名称

        @returns {str} - 返回抖音用户名
        """
        _user_name = ''
        # 启动应用
        self._start_app(device_name, activit_type='user_name')

        # 查找用户昵称
        _steps = self.apps[device_name]['script']['android_user_getName_script']
        try:
            _el = self._exec_appium_steps(device_name, _steps)
            _user_name = _el.text
        except:
            pass

        # 关闭应用
        self._close_app(device_name)

        return _user_name

    def _into_app_line_batch_fun(self, device_name: str, para):
        """
        进入直播的批量线程操作函数

        @param {str} device_name - 设备名称
        @param {object} para - 执行参数

        @returns {tuple(bool, msg)} - 返回处理结果，(是否成功, 结果信息)
        """
        # 先启动APP
        self._start_app(device_name, 'line')

        # 保存默认输入法
        self.apps[device_name]['default_ime'] = self.apps[device_name]['app'].get_default_ime()

        # 设置输入法为 AdbKeyboard
        self.apps[device_name]['app'].set_adbime()

        # 尝试自动进入直播间
        if self.para['auto_into_line']:
            try:
                _steps = self.apps[device_name]['script']['android_line_script']
                # 执行进入操作
                self._exec_appium_steps(device_name, _steps)
            except Exception as e:
                if self.para['into_line_err_exit']:
                    # 进入失败自动退出
                    self._close_app(device_name)
                    return (False, str(e))
                else:
                    # 进入失败不退出，允许手工进入
                    return (True, '失败: %s' % str(e))

        return (True, '成功')

    def _app_send_chat_batch_fun(self, device_name: str, para):
        """
        发送聊天的批量线程操作函数

        @param {str} device_name - 设备名称
        @param {object} para - 要发送的文本

        @returns {tuple(bool, msg)} - 返回处理结果，(是否成功, 结果信息)
        """
        _app_info = self.apps[device_name]
        _app: AppDevice = _app_info['app']
        _current_activity = _app.current_activity
        if _current_activity not in self.para['android_line_appActivity'].split('|'):
            raise RuntimeError('当前[%s]不在直播间，请先手工进入直播间！' % _current_activity)

        # 尝试获取位置信息
        if 'chat_obj_pos' not in _app_info.keys():
            _chat_rect_steps = _app_info['script']['android_chat_rect_script']
            _chat_rect = self._exec_appium_steps(device_name, _chat_rect_steps)
            _app_info['chat_obj_pos'] = [
                _chat_rect[0] + 10, _chat_rect[1] + math.ceil(_chat_rect[3] / 2.0)  # 靠左边点击
            ]

        # 执行点击动作
        self.device_services.minitouch_server.tap(
            [device_name, ], x=_app_info['chat_obj_pos'][0], y=_app_info['chat_obj_pos'][1]
        )
        # _app.tap(x=_app_info['chat_obj_pos'][0], y=_app_info['chat_obj_pos'][1], count=1)

        # 等待1秒，让输入框跳出来
        time.sleep(self.para['android_chat_wait_input'])

        # 发送内容
        _app.adb_keyboard_clear()  # 先清除内容
        _app.adb_keyboard_text(para)

        # 获取发送按钮位置
        if 'chat_send_pos' not in _app_info.keys():
            try:
                _chat_send_steps = _app_info['script']['android_chat_send_script']
                _chat_send_rect = self._exec_appium_steps(device_name, _chat_send_steps)
                _app_info['chat_send_pos'] = [
                    _chat_send_rect[0] + 10, _chat_send_rect[1] +
                    math.ceil(_chat_send_rect[3] / 2.0)  # 靠左边点击
                ]
            except:
                # 获取不到，尝试通过图片匹配
                _chat_send_locate_script = _app_info['script']['android_chat_send_locate']
                _chat_send_rect = self._exec_appium_steps(device_name, _chat_send_locate_script)
                _app_info['chat_send_pos'] = [
                    _chat_send_rect[0] + 10, _chat_send_rect[1] +
                    math.ceil(_chat_send_rect[3] / 2.0)  # 靠左边点击
                ]

        # 执行发送点击动作
        self.device_services.minitouch_server.tap(
            [device_name, ], x=_app_info['chat_send_pos'][0], y=_app_info['chat_send_pos'][1]
        )
        # _app.tap(x=_app_info['chat_send_pos'][0], y=_app_info['chat_send_pos'][1], count=1)

        return (True, '成功')

    def _app_send_heart_batch_fun(self, device_name: str, para):
        """
        送小心心的批量线程操作函数

        @param {str} device_name - 设备名称
        @param {object} para - 参数

        @returns {tuple(bool, msg)} - 返回处理结果，(是否成功, 结果信息)
        """
        _app_info = self.apps[device_name]
        _app: AppDevice = _app_info['app']
        _current_activity = _app.current_activity
        if _current_activity not in self.para['android_line_appActivity'].split('|'):
            raise RuntimeError('当前[%s]不在直播间，请先手工进入直播间！' % _current_activity)

        # 先尝试获取直播室的发言位置对象, 点击
        # _heart_rect = _app_info.get('heart_obj_pos', None)
        _heart_rect_steps = _app_info['script']['android_heart_script']
        try:
            # if _heart_obj is None:
            _heart_rect = self._exec_appium_steps(device_name, _heart_rect_steps)
            # 执行点击操作
            _pos = AppDevice.center(_heart_rect)
            self.device_services.minitouch_server.tap(
                [device_name, ], x=_pos[0], y=_pos[1]
            )
        except:
            # 出现异常做多一次, 先点击一下屏幕中间，尝试恢复正常界面
            print('get heart_obj exception: %s' % traceback.format_exc())
            _heart_rect = self._exec_appium_steps(device_name, _heart_rect_steps)
            # 执行点击操作
            _pos = AppDevice.center(_heart_rect)
            self.device_services.minitouch_server.tap(
                [device_name, ], x=_pos[0], y=_pos[1]
            )

        # 成功执行，保留对象提升速度
        # _app_info['heart_obj'] = _heart_obj

        return (True, '成功')

    def _app_click_car_batch_fun(self, device_name: str, para):
        """
        点击购物车的批量线程操作函数

        @param {str} device_name - 设备名称
        @param {object} para - 参数

        @returns {tuple(bool, msg)} - 返回处理结果，(是否成功, 结果信息)
        """
        _app_info = self.apps[device_name]
        _app: AppDevice = _app_info['app']
        _current_activity = _app.current_activity
        if _current_activity not in self.para['android_line_appActivity'].split('|'):
            raise RuntimeError('当前[%s]不在直播间，请先手工进入直播间！' % _current_activity)

        # 尝试获取对象
        # _car_obj = _app_info.get('car_obj', None)
        _car_rect_steps = _app_info['script']['android_car_script']
        try:
            # if _heart_obj is None:
            _car_rect = self._exec_appium_steps(device_name, _car_rect_steps)
            # 执行点击操作
            _pos = AppDevice.center(_car_rect)
            self.device_services.minitouch_server.tap(
                [device_name, ], x=_pos[0], y=_pos[1]
            )
        except:
            # 出现异常做多一次, 先点击一下屏幕中间，尝试恢复正常界面
            print('get car_obj exception: %s' % traceback.format_exc())
            _car_rect = self._exec_appium_steps(device_name, _car_rect_steps)
            # 执行点击操作
            _pos = AppDevice.center(_car_rect)
            self.device_services.minitouch_server.tap(
                [device_name, ], x=_pos[0], y=_pos[1]
            )

        # 成功执行，保留对象提升速度
        # _app_info['car_obj'] = _car_obj

        return (True, '成功')

    def _app_give_thumbs_up_batch_fun(self, device_name: str, para):
        """
        点赞的批量线程操作函数

        @param {str} device_name - 设备名称
        @param {object} para - 点赞的时长

        @returns {tuple(bool, msg)} - 返回处理结果，(是否成功, 结果信息)
        """
        # 计算中心点，减少每次点击的计算量
        _app_info = self.apps[device_name]
        _app: AppDevice = _app_info['app']
        _current_activity = _app.current_activity
        if _current_activity not in self.para['android_line_appActivity'].split('|'):
            raise RuntimeError('当前[%s]不在直播间，请先手工进入直播间！' % _current_activity)

        if _app_info.get('size', None) is None:
            _app_info['size'] = _app.size

        # 计算点击位置
        _x = math.ceil(_app_info['size'][0] / 2.0)
        _y = math.ceil(_app_info['size'][1] / 2.0)
        _x = _x + math.ceil(_app_info['size'][0] * self.para['give_thumbs_up_offset_x'])
        _y = _y + math.ceil(_app_info['size'][1] * self.para['give_thumbs_up_offset_y'])

        # 生成随机点击种子
        _random_x = None
        if self.para['give_thumbs_up_random_x'] > 0:
            _random_x = math.ceil(_app_info['size'][0] * self.para['give_thumbs_up_random_x'])
        _random_y = None
        if self.para['give_thumbs_up_random_y'] > 0:
            _random_y = math.ceil(_app_info['size'][1] * self.para['give_thumbs_up_random_y'])

        _pos_seed = list()
        for i in range(self.para['give_thumbs_up_random_seed']):
            _pos_seed.append((
                _x + math.ceil(random.uniform(0 - _random_x, _random_x)),
                _y + math.ceil(random.uniform(0 - _random_y, _random_y))
            ))

        # 执行点击操作
        self.device_services.minitouch_server.tap_continuity(
            [device_name, ], pos_seed=_pos_seed, times=para,
            random_sleep=self.para['give_thumbs_up_random_wait'],
            sleep_min=self.para['give_thumbs_up_wait_min'],
            sleep_max=self.para['give_thumbs_up_wait_max']
        )
        # _app.tap_continuity(_pos_seed, para, thread_count=self.para['give_thumbs_up_tap_max'])

        return (True, '成功')

    def _app_tap_screen_batch_fun(self, device_name: str, para):
        """
        点击屏幕的批量线程操作函数

        @param {str} device_name - 设备名称
        @param {object} para - 暂时没有用

        @returns {tuple(bool, msg)} - 返回处理结果，(是否成功, 结果信息)
        """
        # 计算位置
        _app_info = self.apps[device_name]
        _app: AppDevice = _app_info['app']
        _current_activity = _app.current_activity
        if _current_activity not in self.para['android_line_appActivity'].split('|'):
            raise RuntimeError('当前[%s]不在直播间，请先手工进入直播间！' % _current_activity)

        if _app_info.get('size', None) is None:
            _app_info['size'] = _app.size

        _pos = self.bg_para['tap_to_main'].split(',')
        _x = math.ceil(_app_info['size'][0] * float(_pos[0]))
        _y = math.ceil(_app_info['size'][1] * float(_pos[1]))

        # 点击处理
        self.device_services.minitouch_server.tap(
            [device_name, ], x=_x, y=_y
        )
        # _app.tap(x=_x, y=_y)

        return (True, '成功')

    #############################
    # 通用的批量任务内部函数
    #############################

    def _run_batch_task(self, interface_id: str, run_bt_wait: bool = False,
                        min_wait_time: float = 0.0, max_wait_time: float = 1.0):
        """
        按接口id多线程执行批量任务

        @param {str} interface_id - 要执行的接口ID
        @param {bool} run_bt_wait=False - 任务执行之间是否要间隔时长
        @param {float} min_wait_time=0.0 - 间隔最小等待时长, 单位为秒
        @param {float} max_wait_time=1.0 - 间隔最大等待时长, 单位为秒
        """
        _devices = list(self._batch_task.get(interface_id, {}).keys())
        _task_num = len(_devices)
        if _task_num == 0:
            # 没有任务，直接返回
            return
        elif _task_num == 1:
            # 只有一个任务，当前函数执行即可
            self._batch_task_thread_fun(interface_id, _devices[0])
            return

        # 启动多线程执行
        for _device_name in _devices:
            # 每个设备启动一条新线程
            _running_thread = threading.Thread(
                target=self._batch_task_thread_fun,
                name='Thread-Batch-Running %s' % interface_id,
                args=(interface_id, _device_name)
            )
            _running_thread.setDaemon(True)
            _running_thread.start()

            # 间隔随机时间
            if run_bt_wait:
                _time = random.uniform(min_wait_time, max_wait_time)
                time.sleep(_time)

        # 等待多线程的处理结果
        while True:
            _is_end = True
            for _device_name in _devices:
                if self._batch_task[interface_id][_device_name].get('is_success', None) is None:
                    _is_end = False
                    break

            # 检查是否可以退出
            if _is_end:
                break
            else:
                time.sleep(0.01)

    def _batch_task_thread_fun(self, interface_id: str, device_name: str):
        """
        执行批量任务的通用线程函数

        @param {str} interface_id - 接口ID
        @param {str} device_name - 设备名称
        """
        _info = dict()
        try:
            # 执行具体的逻辑代码
            _info = self._batch_task[interface_id][device_name]
            _is_success, _msg = self._batch_fun_mapping[
                _info['type']
            ](device_name, _info['para'])

            # 更新结果
            self._batch_task[interface_id][device_name]['is_success'] = _is_success
            self._batch_task[interface_id][device_name]['msg'] = _msg
        except Exception as e:
            self._batch_task[interface_id][device_name]['is_success'] = False
            self._batch_task[interface_id][device_name]['msg'] = str(e)
            self.logger.log(
                logging.ERROR, 'run batch task [%s] [%s] error: %s' % (
                    device_name, _info.get('type', ''), traceback.format_exc()
                )
            )

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

    def _exec_appium_steps(self, device_name: str, steps: list, last_output=None):
        """
        执行appium的步骤脚本

        @param {str} device_name - 设备名称
        @param {list} steps - 步骤脚本数组
        @param {object} last_output=None - 开始执行时传入上一次执行的输出对象, 可以是 AppElement, 也可以为其他对象

        @returns {object} - 返回执行输出结果元素
        """
        if device_name not in self.apps.keys():
            raise RuntimeError('设备名[%s]不在设备清单中！' % device_name)

        _app: AppDevice = self.apps[device_name]['app']
        _last_output = last_output
        for _script in steps:
            # 逐步执行
            try:
                _last_output = self._exec_appium_script(device_name, _app, _script, _last_output)
            except Exception as e:
                raise RuntimeError('%s: %s' % (_script.get('tips', ''), str(e)))

        # 返回执行结果
        return _last_output

    def _exec_appium_script(self, device_name: str, app: AppDevice, script: dict, last_output):
        """
        执行

        @param {str} device_name - 设备名称
        @param {AppDevice} app - 已连接的设备对象
        @param {dict} script - 脚本字典
        @param {object} last_output - 上一次执行的输出对象, 可以是 AppElement, 也可以为其他对象

        @returns {object} - 返回执行输出结果元素
        """
        _last_output = last_output
        if script['action'] in ('find', 'subfind'):
            # 处理参数
            if 'id' in script.keys():
                _by = MobileBy.ID
                _value = script['id']
            elif 'image' in script.keys():
                _by = MobileBy.IMAGE
                _value = script['image']
            else:
                _by = MobileBy.XPATH
                _value = script.get('xpath', None)

            # 查找对象
            _pos = script.get('pos', None)
            if _pos is None:
                # 查找单一对象
                if script['action'] == 'subfind':
                    # 子查询
                    _last_output = last_output.find_element(
                        by=_by, value=_value, timeout=self.para['implicitly_wait']
                    )
                else:
                    # 当前页面查询
                    _last_output = app.find_element(
                        by=_by, value=_value, timeout=self.para['implicitly_wait']
                    )
            else:
                # 查找多个对象
                if script['action'] == 'subfind':
                    # 子查询
                    _els = last_output.find_elements(
                        by=_by, value=_value, timeout=self.para['implicitly_wait']
                    )
                else:
                    # 当前页面查询
                    _els = app.find_elements(
                        by=_by, value=_value, timeout=self.para['implicitly_wait']
                    )

                _pos = script.get('pos', 0)
                _last_output = _els[_pos]

            # 获取到对象，看是返回对象本身还是返回区域
            _back = script.get('back', 'element')
            if _back == 'rect':
                # 返回对象所在区域
                _last_output = _last_output.rect
        elif script['action'] == 'click':
            # 点击对象
            last_output.click()
        elif script['action'] == 'wait_activity':
            # 等待加载页面
            app.wait_activity(
                script.get('activity'), script.get('timeout'), script.get('interval', 0.1)
            )
        elif script['action'] == 'wait':
            # 等待一会
            time.sleep(script.get('time', 1.0))
        elif script['action'] == 'send_keys':
            # 发送文本
            app.adb_keyboard_text(script.get('keys'))
        elif script['action'] == 'send_adb_keyboard_keycode':
            # 发送按键按键
            app.adb_keyboard_keycode(*script['keycode'])
        elif script['action'] == 'press_keycode':
            # 通过adb发送按键
            app.press_keycode(*script['keycode'])
        elif script['action'] == 'set_ime':
            # 切换输入法
            app.set_default_ime(script['ime'])
        elif script['action'] == 'tap':
            # 点击指定坐标
            self.device_services.minitouch_server.tap(
                [device_name, ], x=script['pos'][0], y=script['pos'][1]
            )
        elif script['action'] == 'locate':
            # 通过图片定位区域
            _last_output = app.locate_on_screen(
                os.path.join(self.config_path, script['image']),
                confidence=script.get('confidence', 0.95),
            )
        elif script['action'] == 'output':
            # 不做处理, 将参数作为输出返回
            _last_output = script.get('output', None)

        # 返回对象
        return _last_output


if __name__ == '__main__':
    # 当程序自己独立运行时执行的操作
    # 打印版本信息
    print(('模块名：%s  -  %s\n'
           '作者：%s\n'
           '发布日期：%s\n'
           '版本：%s' % (__MOUDLE__, __DESCRIPT__, __AUTHOR__, __PUBLISH__, __VERSION__)))
