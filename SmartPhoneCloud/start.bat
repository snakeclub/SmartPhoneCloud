@echo off
REM 后续命令使用的是：UTF-8编码
chcp 65001

REM 跳转到脚本当前文件夹
cd  %~dp0

REM 执行启动服务命令
python server.py

REM 暂停，等待关闭
@echo on
pause