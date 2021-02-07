#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
# Copyright 2019 黎慧剑
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""
插件管理模块
@module plugin
@file plugin.py
"""
import os
import sys
import threading
import sqlite3
import logging
from flask import request, render_template
from HiveNetLib.base_tools.file_tool import FileTool
from HiveNetLib.base_tools.import_tool import ImportTool
from HiveNetLib.simple_xml import SimpleXml
# 根据当前文件路径将包路径纳入，在非安装的情况下可以引用到
sys.path.append(os.path.abspath(os.path.join(
    os.path.dirname(__file__), os.path.pardir, os.path.pardir)))


__MOUDLE__ = 'plugin'  # 模块名
__DESCRIPT__ = u'插件管理模块'  # 模块描述
__VERSION__ = '0.1.0'  # 版本
__AUTHOR__ = u'黎慧剑'  # 作者
__PUBLISH__ = '2021.01.26'  # 发布日期


class PluginManager(object):
    """
    插件管理模块
    """

    #############################
    # 构造函数
    #############################
    def __init__(self, config_services, device_services, flask_server, config_path: str = None, plugin_path: str = None,
                 always_update: bool = False, logger=None):
        """
        插件管理模块

        @param {ConfigServices} config_services - 框架的配置服务对象
        @param {DeviceServices} device_services - 框架的设备服务对象
        @param {FlaskServer} flask_server - Flask服务对象

        @param {str} config_path=None - 配置文件目录
        @param {str} plugin_path=None - 插件搜索目录
        @param {bool} always_update=False - 启动时是否强制更新文件
        @param {Logger} logger=None - 日志对象
        """
        # 服务对象
        self.config_services = config_services
        self.device_services = device_services
        self.flask_server = flask_server

        # 配置目录
        self.config_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), os.path.pardir, 'config')
        ) if config_path is None else config_path
        # 插件目录
        self.plugin_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), os.path.pardir, 'plugin')
        ) if plugin_path is None else plugin_path

        self.always_update = always_update

        self.logger = logger
        if self.logger is None:
            self.logger = logging.getLogger()

        # 内部的控制变量
        self._db_lock = threading.RLock()  # 数据访问锁，保证单线程访问

        # 连接配置库, 需要允许多线程访问
        self.db_conn = sqlite3.connect(
            os.path.join(self.config_path, 'plugin.db'), check_same_thread=False
        )

        # 创建所需的配置表
        self._exec_sql(
            'create table if not exists t_installed(plugin_name varchar(30) primary key, show_name varchar(30), dir_name varchar(30))'
        )  # 已安装插件清单

        # 路径相关配置
        self.static_path = os.path.join(os.path.dirname(__file__), os.path.pardir, 'website')
        self.templates_path = os.path.join(os.path.dirname(__file__), os.path.pardir, 'templates')

        # 内存变量
        self.imported_moudles = dict()  # 已装载的模块
        self.plugins_dict = dict()  # 插件配置信息字典
        self.plugins_toolbar = list()  # 在浮动工具入口的插件
        self.plugins_tab = list()  # 在tab页提供相应入口

        # 检索安装
        self.auto_install(True)

    #############################
    # 公共的页面渲染函数
    #############################
    def plugin_index(self):
        """
        公共的插件渲染函数
        """
        _plugin_name = request.endpoint
        _info = self.plugins_dict[_plugin_name]
        if _info['render_type'] == 'templates':
            # 模板方式渲染
            if _info['render_para'].startswith('/'):
                _template = _info['render_para'][1:]
            else:
                _template = 'plugin/%s/%s' % (_plugin_name, _info['render_para'])

            # 执行处理
            return render_template(
                _template, plugin_name=_plugin_name, info=_info
            )
        else:
            # 按照静态目录返回文件
            if _info['render_para'].startswith('/'):
                _file = _info['render_para'][1:]
            else:
                _file = 'plugin/%s/%s' % (_plugin_name, _info['render_para'])

            # 返回文件
            self.flask_server.app.send_static_file(_file)

    #############################
    # 工具函数
    #############################
    def is_installed(self, plugin_name: str):
        """
        判断插件是否已安装

        @param {str} plugin_name - 插件名
        """
        _fetchs = self._exec_sql(
            'select plugin_name from t_installed where plugin_name=?',
            para=(plugin_name, ), is_fetchall=True
        )

        return len(_fetchs) > 0

    def load_plugin(self, plugin_name: str):
        """
        装载已安装的插件到服务中

        @param {str} plugin_name - 插件名
        """
        _fetchs = self._exec_sql(
            'select dir_name from t_installed where plugin_name=?',
            para=(plugin_name, ), is_fetchall=True
        )
        _dir_name = _fetchs[0][0]

        # 获取插件配置
        _plugin_config = SimpleXml(
            os.path.join(self.plugin_path, _dir_name, 'plugin.xml')
        ).to_dict()['config']

        # 装载后台服务
        self.imported_moudles[plugin_name] = dict()
        _import = _plugin_config['import']
        for _module_name in _import.keys():
            # 装载模块
            _extend_path = os.path.join(
                self.plugin_path, _dir_name, 'lib', _import[_module_name]['extend_path']
            )

            _module = ImportTool.import_module(
                _module_name, extend_path=_extend_path
            )
            self.imported_moudles[plugin_name][_module_name] = _module

            # 初始化类并加入Restful服务
            _init_class = _import[_module_name]['init_class']
            for _class_name in _init_class.keys():
                _class_object = ImportTool.get_member_from_module(_module, _class_name)
                if _init_class[_class_name]['init_type'] == 'instance':
                    _class_object = _class_object(
                        config_services=self.config_services,
                        device_services=self.device_services,
                        config_path=os.path.join(
                            self.config_path, 'plugin',
                            _plugin_config['info']['plugin_name']
                        ),
                        plugin_path=self.plugin_path, logger=self.logger
                    )

                # 加入Restful服务
                if _init_class[_class_name].get('add_route_by_class', False):
                    # 处理服务黑名单
                    _blacklist = _init_class[_class_name].get('blacklist', [])
                    for _i in range(len(_blacklist)):
                        _blacklist[_i] = '%s/%s' % (_class_name, _blacklist[_i])

                    # 添加路由
                    self.flask_server.add_route_by_class([_class_object], blacklist=_blacklist)

        # 装载主页的入口路由
        if _plugin_config['info'].get('url', '') != '':
            self.flask_server.add_route(
                _plugin_config['info']['url'], self.plugin_index, endpoint=plugin_name
            )

        # 处理插件内存信息
        _plugin_config['info']['plugin_name'] = plugin_name  # 避免中途被修改
        self.plugins_dict[plugin_name] = _plugin_config['info']
        if _plugin_config['info']['entrance_type'] == 'toolbar':
            self.plugins_toolbar.append(plugin_name)
        else:
            self.plugins_tab.append(plugin_name)

    def unload_plugin(self, plugin_name: str):
        """
        从服务中卸载已安装的插件

        @param {str} plugin_name - 插件名
        """
        # 暂时不支持路由的卸载，因此只处理插件内存信息，取消掉入口
        if plugin_name in self.plugins_toolbar:
            self.plugins_toolbar.remove(plugin_name)

        if plugin_name in self.plugins_tab:
            self.plugins_tab.remove(plugin_name)

        self.plugins_dict.pop(plugin_name, None)

    #############################
    # 处理函数
    #############################

    def install(self, dir_name: str):
        """
        安装插件

        @param {str} dir_name - 插件所在路径名
        """
        _plugin_path = os.path.join(self.plugin_path, dir_name)

        # 获取插件配置
        _plugin_config = SimpleXml(
            os.path.join(_plugin_path, 'plugin.xml')
        ).to_dict()['config']['info']

        # 复制文件到对应目录
        _static_path = os.path.join(_plugin_path, 'static')  # 静态文件, js/css/img/html等
        if os.path.exists(_static_path):
            # 先创建目标文件
            _dest_path = os.path.join(self.static_path, 'plugin', _plugin_config['plugin_name'])
            FileTool.create_dir(_dest_path, exist_ok=True)
            FileTool.copy_all_with_path(
                src_path=_static_path, dest_path=_dest_path, exist_ok=True
            )

        _templates_path = os.path.join(_plugin_path, 'templates')  # 模板文件
        if os.path.exists(_templates_path):
            # 先创建目标文件
            _dest_path = os.path.join(self.templates_path, 'plugin', _plugin_config['plugin_name'])
            FileTool.create_dir(_dest_path, exist_ok=True)
            FileTool.copy_all_with_path(
                src_path=_templates_path, dest_path=_dest_path, exist_ok=True
            )

        _config_path = os.path.join(_plugin_path, 'config')  # 配置文件
        if os.path.exists(_config_path):
            # 先创建目标文件
            _dest_path = os.path.join(self.config_path, 'plugin', _plugin_config['plugin_name'])
            FileTool.create_dir(_dest_path, exist_ok=True)
            FileTool.copy_all_with_path(
                src_path=_config_path, dest_path=_dest_path, exist_ok=True
            )

        # 登记安装信息
        self._exec_sql(
            "replace into t_installed values(?, ?, ?)",
            para=(_plugin_config['plugin_name'], _plugin_config['show_name'], dir_name)
        )

        # 加载插件
        self.load_plugin(_plugin_config['plugin_name'])

    def uninstall(self, plugin_name: str):
        """
        卸载指定插件

        @param {str} plugin_name - 插件名
        """
        # 删除主界面入口
        self.unload_plugin(plugin_name)

        # 删除相应文件
        _static_path = os.path.join(self.static_path, 'plugin', plugin_name)
        if os.path.exists(_static_path):
            FileTool.remove_dir(_static_path)

        _templates_path = os.path.join(self.templates_path, 'plugin', plugin_name)
        if os.path.exists(_templates_path):
            FileTool.remove_dir(_templates_path)

        _config_path = os.path.join(self.config_path, 'plugin', plugin_name)
        if os.path.exists(_config_path):
            FileTool.remove_dir(_config_path)

        # 删除安装信息
        self._exec_sql(
            "delete from t_installed where plugin_name=?",
            para=(plugin_name, )
        )

    #############################
    # 自动检索安装
    #############################
    def auto_install(self, is_init: bool):
        """
        自动检索目录并进行安装

        @param {bool} is_init - 指示是否第一次运行
        """
        _deal_plugins = list()
        _dirs = FileTool.get_dirlist(self.plugin_path, is_fullpath=False)
        for _dir_name in _dirs:
            _plugin_config = SimpleXml(
                os.path.join(self.plugin_path, _dir_name, 'plugin.xml')
            ).to_dict()['config']

            # 登记信息
            _deal_plugins.append(_plugin_config['info']['plugin_name'])

            if self.is_installed(_plugin_config['info']['plugin_name']):
                # 已安装, 判断是否要强制更新
                if not (is_init and self.always_update):
                    # 非强制更新
                    continue

            # 执行安装处理
            self.install(_dir_name)

        # 卸载插件目录没有的插件
        _fetchs = self._exec_sql(
            'select plugin_name from t_installed', is_fetchall=True
        )
        for _row in _fetchs:
            if _row[0] not in _deal_plugins:
                # 插件已不存在，卸载处理
                self.uninstall(_row[0])

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


if __name__ == '__main__':
    # 当程序自己独立运行时执行的操作
    # 打印版本信息
    print(('模块名：%s  -  %s\n'
           '作者：%s\n'
           '发布日期：%s\n'
           '版本：%s' % (__MOUDLE__, __DESCRIPT__, __AUTHOR__, __PUBLISH__, __VERSION__)))
