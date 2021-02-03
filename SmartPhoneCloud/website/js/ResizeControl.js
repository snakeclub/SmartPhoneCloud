/*-----------------------
JQuery-UITool v1.0.0
完成时间：2011-
作者：黎慧剑
联系方式:snakeclub@163.com
程序说明：基于JQuery框架的Web界面便捷工具,基于该工具，可以通过简单的函数调用实现各类Web界面效果，简化Web开发

当前控件：ResizeControl
说明：设置页面对象改变大小的控件
文件：ResizeControl.js
依赖文件：jquery-1.6.4.min.js
          ToolFunction.js
          
-----------------------*/

/*-----------------------
==ResizeControl==
设置页面对象改变大小的控件
-----------------------*/

;(function($) {
    /*
    --JQuery_UITool_ResizeControl--
    通用的改变对象大小控件公用变量，注意调用界面不能使用这个变量
    */
    var JQuery_UITool_ResizeControl = null;
    
    /*
      --$.DragControl.defaults--
      托拽事件的默认参数，可以通过修改该默认参数来令所有托拽事件的参数变更
    */
    $.ResizeControl = new Object();
    $.ResizeControl.defaults = {
        //是否显示右下角的改变大小的工具块
        showConnerTool : true,
        
        //改变大小的方式，div - 用一虚线的div框来显示最终的大小，obj - 直接对对象改变大小
        resizeType : "obj",
        
        //div框的样式
        divStyle : {
            "z-index" : 10000,
            border : "1px dashed #0099FF"
        },
        
        //允许改变大小的方向
        direction : {left:true,top:true,right:true,bottom:true},
        
        //改变大小的限制,-1代表无限制
        limit : {maxWidth:-1,maxHeight:-1,minWidth:-1,minHeight:-1},
        
        //Resize工具的z-index，-1默认为对象z-index+10,其他数值为指定z-index
        zIndex : -1,
        
        //改变大小框的位置，inner-紧贴对象内部，outer-紧贴对象外部，默认为inner
        position : "inner",
        
        //边框大小，默认为3
        borderWidth: 3,
        
        //边框的颜色，如果是inner的情况，对象又有边框，就必须设置颜色才能正常使用改变大小控件。例如"#ff0000"，""代表透明色，默认为""
        borderColor : "",
        
        //边角处宽度,默认为14
        connerWidth : 14,
        
        //右下角的改变大小的工具块的Css样式名，例如"SizeControlConnerClass"，默认为""
        connerClass : "",
        
        //开始改变大小前执行的函数，传入的参数依次为对象本身、改变大小参数、event（mousedown），必须返回true/false，若返回false，则终止改变大小操作
        beginResizeFun : null,
        
        //拖动改变大小过程中执行的函数，传入的参数依次为对象本身、改变大小参数、event（mousemove）、objpos{left,top}、objsize{width,height}，必须返回true/false，若返回false，则不调整对象大小
        resizeMoveFun : null,
        
        //确认是否改变大小的函数，传入的参数依次为对象本身、改变大小参数、event（mousemove）、objpos{left,top}、objsize{width,height}，必须返回true/false，若返回false，则不调整对象大小
        confirmResizeFun : null,
        
        //结束改变大小后执行的函数，传入的参数依次为confirmResizeFun返回结果、对象本身、改变大小参数、event（mouseup）、objpos{left,top}、objsize{width,height}
        endResizeFun : null
    };
    
    /*
      --SetResizeAble--
      设置对象为可被改变大小
    */
    $.fn.SetResizeAble = function(opts) {
        if(this.length == 0){
            return;
        }
        //自定义参数
	    opts = $.extend({}, $.ResizeControl.defaults, opts || {});
	    opts.divStyle = $.extend({}, $.ResizeControl.defaults.divStyle, opts.divStyle || {});
	    opts.direction = $.extend({}, $.ResizeControl.defaults.direction, opts.direction || {});
	    opts.limit = $.extend({}, $.ResizeControl.defaults.limit, opts.limit || {});
	    
	    //如果右边和下边其中一个不能修改大小，则不显示右下角的控件
	    if(!(opts.direction.right && opts.direction.bottom)){
	        opts.showConnerTool = false;
	    }
	    
	    //循环对每个对象进行处理
	    for(var i = 0;i<this.length;i++){
	        var obj = $(this.get(i));
	        //检查对象是否已经进行过改变大小的处理
            var IsReSizeAble = obj.attr("resizeable");
            if(IsReSizeAble === undefined || IsReSizeAble == null ||IsReSizeAble == ""){
                //为对象设置改变大小参数
                obj.attr("resizeable","true");
                
                //将改变大小控件放到对象的第一个位置
                if(obj.children().length > 0){
                    obj.children().first().before("<div style='width:0px; height:0px; border: 0px solid #000; background-color:#ffff00;overflow:visible; margin:0px; font-size:0px;' selftype='ResizeControl'></div>");
                }
                else{
                    obj.append("<div style='width:0px; height:0px; border: 0px solid #000; background-color:#ffff00;overflow:visible; margin:0px; font-size:0px;' selftype='ResizeControl'></div>");
                }
                var ResizeControl = obj.children("[selftype='ResizeControl']");
                ResizeControl.data("resizeOpts",opts);
                
                //添加各类工具条
                ResizeControl.append("<div selftype='ResizeControl_Up' style='position:absolute; background-color:Transparent; font-size:0px; height:"+opts.borderWidth+"px; cursor:n-resize;'></div>  \
                                      <div selftype='ResizeControl_Left' style='position:absolute; background-color:Transparent; font-size:0px; width:"+opts.borderWidth+"px; cursor:w-resize;'></div>  \
                                      <div selftype='ResizeControl_Right' style='position:absolute; background-color:Transparent; font-size:0px; width:"+opts.borderWidth+"px; cursor:e-resize;'></div>  \
                                      <div selftype='ResizeControl_Down' style='position:absolute; background-color:Transparent; font-size:0px; height:"+opts.borderWidth+"px; cursor:s-resize;'></div>  \
                                      <div selftype='ResizeControl_UpLeft' style='position:absolute; background-color:Transparent; font-size:0px; height:"+opts.borderWidth+"px; width:"+opts.connerWidth+"px; cursor:nw-resize;'></div>  \
                                      <div selftype='ResizeControl_LeftUp' style='position:absolute; background-color:Transparent; font-size:0px; width:"+opts.borderWidth+"px; height:"+opts.connerWidth+"px; cursor:nw-resize;'></div>  \
                                      <div selftype='ResizeControl_UpRight' style='position:absolute; background-color:Transparent; font-size:0px; height:"+opts.borderWidth+"px; width:"+opts.connerWidth+"px;cursor:ne-resize;'></div>  \
                                      <div selftype='ResizeControl_RightUp' style='position:absolute; background-color:Transparent; font-size:0px; width:"+opts.borderWidth+"px; height:"+opts.connerWidth+"px; cursor:ne-resize;'></div>  \
                                      <div selftype='ResizeControl_DownLeft' style='position:absolute; background-color:Transparent; font-size:0px; height:"+opts.borderWidth+"px; width:"+opts.connerWidth+"px; cursor:sw-resize;'></div>  \
                                      <div selftype='ResizeControl_LeftDown' style='position:absolute; background-color:Transparent; font-size:0px; width:"+opts.borderWidth+"px; height:"+opts.connerWidth+"px; cursor:sw-resize;'></div>  \
                                      <div selftype='ResizeControl_DownRight' style='position:absolute; background-color:Transparent; font-size:0px; height:"+opts.borderWidth+"px; width:"+opts.connerWidth+"px; cursor:se-resize;'></div>  \
                                      <div selftype='ResizeControl_RightDown' style='position:absolute; background-color:Transparent; font-size:0px; width:"+opts.borderWidth+"px; height:"+opts.connerWidth+"px; cursor:se-resize;'></div>  \
                                      <div selftype='ResizeControl_RightConner' style='position:absolute; background-color:Transparent; font-size:0px; width:"+opts.connerWidth+"px; height:"+opts.connerWidth+"px; cursor:se-resize;'></div>  \
                ");
                
                //控制显示
                ResizeControl_ToolShowHide(ResizeControl);
                
                //设置z-index
                var tempzindex;
                if(opts.zIndex == -1){
                    tempzindex = obj.css("z-index") + 20;
                }
                else{
                    tempzindex = opts.zIndex;
                }                
                ResizeControl.css("z-index",tempzindex); //z-index
                
                //边框颜色
                if(opts.borderColor != ""){
                    ResizeControl.find("div").css("background-color",opts.borderColor);
                    ResizeControl.find("div[selftype='ResizeControl_RightConner']").css("background-color","Transparent");
                }
                
                //右下角样式
                if(opts.connerClass != ""){
                    ResizeControl.find("div[selftype='ResizeControl_RightConner']").addClass(opts.connerClass);
                }
                                
                //调用改变大小的函数,配置各个状态栏的位置
                ResizeControl_ObjResize_Fun(ResizeControl);                
                
                //绑定各类事件
                obj.bind("resize",ResizeControl_ObjResize);
                ResizeControl.find('div').bind("mousedown",ResizeControl_ResizeClickDown);
                
            }//if(IsReSizeAble === undefined || IsReSizeAble == null ||IsReSizeAble == ""){
	    }
	    
    };
    
    /*
      --ClearResizeAble--
        清除改变大小控件
     */
     $.fn.ClearResizeAble = function() {
        //如果没有对象，直接退出
        if(this.length == 0){
          return;
        }
        var obj;  //要处理的对象
        for(var j=0;j<this.length;j++){
            obj = $(this.get(j));
            //检查对象是否已经进行过改变大小的处理
            var IsReSizeAble = obj.attr("resizeable");
            if(IsReSizeAble === undefined || IsReSizeAble == null ||IsReSizeAble == ""){
                //对象没有加载过改变大小控件
                return;
            }
            
            //删除对象
            obj.children("div[selftype='ResizeControl']").remove();
            
            //删除事件
            obj.unbind("resize",ResizeControl_ObjResize);
            
            //删除属性
            obj.removeAttr("resizeable");
        }
     };
    
    //以下部分为内部函数
    /*---------------
    --ResizeControl_ToolShowHide--
    内部函数
    根据参数控制改变大小工具的具体边框是否启用
    --------------- */
    function ResizeControl_ToolShowHide(ResizeControl){
        var opts = ResizeControl.data("resizeOpts");
        //右下角边框
        if(opts.showConnerTool){
            ResizeControl.find("div[selftype='ResizeControl_RightConner']").show();
        }
        else{
            ResizeControl.find("div[selftype='ResizeControl_RightConner']").hide();
        }
        
        //先全部显示，然后将不该显示的屏蔽
        ResizeControl.find("div[selftype!='ResizeControl_RightConner']").show();
        
        if(!opts.direction.left){
            ResizeControl.find("div[selftype*='Left'][selftype^='ResizeControl_']").hide();
        }
        
        if(!opts.direction.top){
            ResizeControl.find("div[selftype*='Up'][selftype^='ResizeControl_']").hide();
        }
        
        if(!opts.direction.right){
            ResizeControl.find("div[selftype*='Right'][selftype^='ResizeControl_'][selftype!='ResizeControl_RightConner']").hide();
        }
        
        if(!opts.direction.bottom){
            ResizeControl.find("div[selftype*='Down'][selftype^='ResizeControl_']").hide();
        }
    };
    
    /*---------------
    --ResizeControl_ObjResize_Fun--
    内部函数
    调用改变大小的函数,配置各个状态栏的位置
    ResizeControl_ObjResize_Fun(ResizeControl)
    --------------- */
    function ResizeControl_ObjResize_Fun(ResizeControl){
        var obj = $(ResizeControl.get(0).parentNode);
        var objwidth = obj.outerWidth(false);
        var objheight = obj.outerHeight(false);
        var objborderleft = parseInt(obj.css("border-left-width").slice(0,-2));
        if(isNaN(objborderleft)){
            objborderleft = 0;
        }
        var objbordertop = parseInt(obj.css("border-top-width").slice(0,-2));
        if(isNaN(objbordertop)){
            objbordertop = 0;
        }
        
        var opts = ResizeControl.data("resizeOpts");
        if(opts.position == "outer"){
            //边框在外面
            objwidth = objwidth + opts.borderWidth*2;
            objheight = objheight + opts.borderWidth*2;
            objborderleft = objborderleft + opts.borderWidth;
            objbordertop = objbordertop + opts.borderWidth;
        }
        
        //上边
        ResizeControl.find("div[selftype='ResizeControl_Up']").css({ width: objwidth + "px", left: (0-objborderleft)+"px", top:(0-objbordertop)+"px"});

        //下边
        ResizeControl.find("div[selftype='ResizeControl_Down']").css({ width: objwidth + "px", left: (0-objborderleft)+"px", top:(objheight-opts.borderWidth - objbordertop) + "px" });
        //左边
        ResizeControl.find("div[selftype='ResizeControl_Left']").css({ height: objheight + "px", left: (0-objborderleft)+"px", top:(0-objbordertop)+"px" });
        //右边
        ResizeControl.find("div[selftype='ResizeControl_Right']").css({ height: objheight + "px", left: (objwidth-opts.borderWidth-objborderleft)+"px", top:(0-objbordertop)+"px"});
        //左上角
        ResizeControl.find("div[selftype='ResizeControl_UpLeft']").css({ width: opts.connerWidth + "px", left: (0-objborderleft)+"px", top:(0-objbordertop)+"px" });
        ResizeControl.find("div[selftype='ResizeControl_LeftUp']").css({ height: opts.connerWidth + "px", left: (0-objborderleft)+"px", top:(0-objbordertop)+"px" });
        //右上角
        ResizeControl.find("div[selftype='ResizeControl_UpRight']").css({ width: opts.connerWidth + "px", left: (objwidth-opts.connerWidth-objborderleft)+"px", top:(0-objbordertop)+"px" });
        ResizeControl.find("div[selftype='ResizeControl_RightUp']").css({ height: opts.connerWidth + "px", left: (objwidth-opts.borderWidth-objborderleft)+"px", top:(0-objbordertop)+"px" });
        //左下角
        ResizeControl.find("div[selftype='ResizeControl_DownLeft']").css({ width: opts.connerWidth + "px", left:(0-objborderleft)+"px", top:(objheight-opts.borderWidth-objbordertop)+"px" });
        ResizeControl.find("div[selftype='ResizeControl_LeftDown']").css({ height: opts.connerWidth + "px", left: (0-objborderleft)+"px", top:(objheight-opts.connerWidth-objbordertop)+"px"});
        //右下角
        ResizeControl.find("div[selftype='ResizeControl_DownRight']").css({ width: opts.connerWidth + "px", left:(objwidth-opts.connerWidth-objborderleft)+"px", top:(objheight-opts.borderWidth-objbordertop)+"px" });
        ResizeControl.find("div[selftype='ResizeControl_RightDown']").css({ height: opts.connerWidth + "px", left: (objwidth-opts.borderWidth-objborderleft)+"px", top:(objheight-opts.connerWidth-objbordertop)+"px"});
        //改变大小工具块
        ResizeControl.find("div[selftype='ResizeControl_RightConner']").css({left:(objwidth-opts.connerWidth-objborderleft)+"px", top:(objheight-opts.connerWidth-objbordertop)+"px" });
    };
    
    /*---------------
    --ResizeControl_ObjResize--
    内部函数
    对象改变大小调用的函数,配置各个状态栏的位置
    ResizeControl_ObjResize()
    --------------- */
    function ResizeControl_ObjResize(){
        var ResizeControl = $(this).children("div[selftype='ResizeControl']");
        if(ResizeControl.length == 1){
            ResizeControl_ObjResize_Fun(ResizeControl);
        }
    };
    
    /*---------------
    --ResizeControl_ResizeClickDown--
    内部函数
    调用改变大小的函数,配置各个状态栏的位置
    ResizeControl_ResizeClickDown()
    --------------- */
    function ResizeControl_ResizeClickDown(){
        var ResizeControl = $(this.parentNode);
        var obj = $(ResizeControl.get(0).parentNode);
        var opts = ResizeControl.data("resizeOpts");
        
        //开始改变大小前执行的函数，传入的参数依次为对象本身、改变大小参数、event（mousedown），必须返回true/false，若返回false，则终止改变大小操作
        var beginret = true;
        if(opts.beginResizeFun != null){
            try{
                beginret = opts.beginResizeFun(obj,opts,event);
            }catch(e){;}
        }
        if(!beginret){
            return;
        }

        
        
        //看看改变大小的方式
        if(opts.resizeType == "div"){
            //获得对象位置
            var objpos = obj.getElementPos();
            
            //创建显示Div
            var html = "<div id='ResizeControlTempDiv' style='margin:0px; padding:0px; position:absolute;'></div>";
            
            $(document.body).append(html);
            
            
            var DivObj = $("#ResizeControlTempDiv");
            DivObj.css(opts.divStyle);
            
            //设置初始大小
            var DivWidth = obj.outerWidth();
            var DivHeight = obj.outerHeight();
            DivObj.css({width:DivWidth+"px",height:DivHeight+"px"});
            
            //参数
            JQuery_UITool_ResizeControl = obj;
            JQuery_UITool_ResizeControl.showObj = DivObj;
            JQuery_UITool_ResizeControl.opts = opts;
            JQuery_UITool_ResizeControl.Resizing = true;
            JQuery_UITool_ResizeControl.startx = event.clientX;
            JQuery_UITool_ResizeControl.starty = event.clientY;
            JQuery_UITool_ResizeControl.l = objpos.x - 2 - parseInt(DivObj.css("border-left-width"));
            JQuery_UITool_ResizeControl.t = objpos.y - 2 - parseInt(DivObj.css("border-top-width"));
            JQuery_UITool_ResizeControl.w = DivWidth;
            JQuery_UITool_ResizeControl.h = DivHeight;
            JQuery_UITool_ResizeControl.type = $(this).attr("selftype");
            JQuery_UITool_ResizeControl.maxwidth = DivWidth + (opts.limit.maxWidth - obj.width());
            JQuery_UITool_ResizeControl.maxheight = DivHeight + (opts.limit.maxHeight - obj.height());
            JQuery_UITool_ResizeControl.minwidth = Math.max(opts.connerWidth,opts.limit.minWidth);
            JQuery_UITool_ResizeControl.minheight = Math.max(opts.connerWidth,opts.limit.minHeight);
            JQuery_UITool_ResizeControl.minwidth = DivWidth - (obj.width() - JQuery_UITool_ResizeControl.minwidth);
            JQuery_UITool_ResizeControl.minheight = DivHeight - (obj.height() - JQuery_UITool_ResizeControl.minheight);
            
            DivObj.css({left:JQuery_UITool_ResizeControl.l+"px",top:JQuery_UITool_ResizeControl.t+"px"});
            
            //额外的辅助字段
            JQuery_UITool_ResizeControl.ol = parseInt(obj.css("left").slice(0,-2));
            JQuery_UITool_ResizeControl.ot = parseInt(obj.css("top").slice(0,-2));
            JQuery_UITool_ResizeControl.ow = obj.width();
            JQuery_UITool_ResizeControl.oh = obj.height();
        }
        else{
            JQuery_UITool_ResizeControl = obj;
            JQuery_UITool_ResizeControl.showObj = obj;
            JQuery_UITool_ResizeControl.opts = opts;
            JQuery_UITool_ResizeControl.Resizing = true;
            JQuery_UITool_ResizeControl.startx = event.clientX;
            JQuery_UITool_ResizeControl.starty = event.clientY;
            JQuery_UITool_ResizeControl.l = parseInt(obj.css("left").slice(0,-2));
            JQuery_UITool_ResizeControl.t = parseInt(obj.css("top").slice(0,-2));
            JQuery_UITool_ResizeControl.w = obj.width();
            JQuery_UITool_ResizeControl.h = obj.height();
            JQuery_UITool_ResizeControl.type = $(this).attr("selftype");
            JQuery_UITool_ResizeControl.maxwidth = opts.limit.maxWidth;
            JQuery_UITool_ResizeControl.maxheight = opts.limit.maxHeight;
            JQuery_UITool_ResizeControl.minwidth = Math.max(opts.connerWidth,opts.limit.minWidth);
            JQuery_UITool_ResizeControl.minheight = Math.max(opts.connerWidth,opts.limit.minHeight);
        }
        
        ResizeControl.get(0).setCapture();
        
         //绑定窗体的鼠标移动和鼠标松开按钮
         $(document.body).bind("mousemove",ResizeControl_MouseMove);
         $(document.body).bind("mouseup",ResizeControl_EndResize);
         
         //禁止冒泡，不让其他控件生效
         return false;
    };

    /*
    --ResizeControl_MouseMove--
    内部函数，拖拽时移动鼠标时所执行的函数
    */
    var ResizeControl_MouseMove = function(){
        if(JQuery_UITool_ResizeControl != null && JQuery_UITool_ResizeControl.Resizing == true){
            //鼠标移动
            var MoveDir = "NNNN";  //顺序为"左上右下"
            
            switch(JQuery_UITool_ResizeControl.type){
                case "ResizeControl_Up":
                    MoveDir = "NYNN";
                    break;
                case "ResizeControl_Down":
                    MoveDir = "NNNY";
                    break;
                case "ResizeControl_Left":
                    MoveDir = "YNNN";
                    break;
                case "ResizeControl_Right":
                    MoveDir = "NNYN";
                    break;
                case "ResizeControl_RightUp":
                case "ResizeControl_UpRight":
                    MoveDir = "NYYN";
                    break;
                case "ResizeControl_LeftUp":
                case "ResizeControl_UpLeft":
                    MoveDir = "YYNN";
                    break;
                case "ResizeControl_RightDown":
                case "ResizeControl_DownRight":
                case "ResizeControl_RightConner":
                    MoveDir = "NNYY";
                    break;
                case "ResizeControl_LeftDown":
                case "ResizeControl_DownLeft":
                    MoveDir = "YNNY";
                    break;
                default :
                    return;
            }
            
            var objpos = {left:JQuery_UITool_ResizeControl.l,top:JQuery_UITool_ResizeControl.t};
            var objsize = {width:JQuery_UITool_ResizeControl.w,height:JQuery_UITool_ResizeControl.h};
            
            if(MoveDir.substr(0,1) == "Y"){
                //向左
                var lstep = event.clientX - JQuery_UITool_ResizeControl.startx;
                if(lstep > JQuery_UITool_ResizeControl.w - JQuery_UITool_ResizeControl.minwidth){
                    lstep = JQuery_UITool_ResizeControl.w - JQuery_UITool_ResizeControl.minwidth;
                }
                else if(JQuery_UITool_ResizeControl.maxwidth > 0 && (lstep < JQuery_UITool_ResizeControl.w - JQuery_UITool_ResizeControl.maxwidth)){
                    lstep = JQuery_UITool_ResizeControl.w - JQuery_UITool_ResizeControl.maxwidth;
                }
                
                //开始移动
                objsize.width = JQuery_UITool_ResizeControl.w - lstep;
                objpos.left = JQuery_UITool_ResizeControl.l+(JQuery_UITool_ResizeControl.w - objsize.width);
            }
            
            if(MoveDir.substr(1,1) == "Y"){
                //向上
                var tstep = event.clientY - JQuery_UITool_ResizeControl.starty;
                if(tstep > JQuery_UITool_ResizeControl.h - JQuery_UITool_ResizeControl.minheight){
                    tstep = JQuery_UITool_ResizeControl.h - JQuery_UITool_ResizeControl.minheight;
                }
                else if(JQuery_UITool_ResizeControl.maxheight > 0 && (tstep < JQuery_UITool_ResizeControl.h - JQuery_UITool_ResizeControl.maxheight)){
                    tstep = JQuery_UITool_ResizeControl.h - JQuery_UITool_ResizeControl.maxheight;
                }
                //开始移动
                objsize.height = JQuery_UITool_ResizeControl.h - tstep;
                objpos.top = JQuery_UITool_ResizeControl.t+(JQuery_UITool_ResizeControl.h - objsize.height);
            }
            
            if(MoveDir.substr(2,1) == "Y"){
                //向右
                var rstep = event.clientX - JQuery_UITool_ResizeControl.startx;
                
                if(rstep < (JQuery_UITool_ResizeControl.minwidth - JQuery_UITool_ResizeControl.w)){
                    //小于最小大小
                    rstep = JQuery_UITool_ResizeControl.minwidth - JQuery_UITool_ResizeControl.w;
                }
                else if(JQuery_UITool_ResizeControl.maxwidth > 0 
                    && rstep > (JQuery_UITool_ResizeControl.maxwidth - JQuery_UITool_ResizeControl.w)){
                    //大于最大大小
                    rstep = JQuery_UITool_ResizeControl.maxwidth - JQuery_UITool_ResizeControl.w;
                }
                
                //改变大小
                objsize.width = JQuery_UITool_ResizeControl.w+rstep;
            }
            
            if(MoveDir.substr(3,1) == "Y"){
                //向下
                var bstep = event.clientY - JQuery_UITool_ResizeControl.starty;
                if(bstep < (JQuery_UITool_ResizeControl.minheight - JQuery_UITool_ResizeControl.h)){
                    //小于最小大小
                    bstep = JQuery_UITool_ResizeControl.minheight - JQuery_UITool_ResizeControl.h;
                }
                else if(JQuery_UITool_ResizeControl.maxheight > 0 
                    && bstep > (JQuery_UITool_ResizeControl.maxheight - JQuery_UITool_ResizeControl.h)){
                    //大于最大大小
                    bstep = JQuery_UITool_ResizeControl.maxheight - JQuery_UITool_ResizeControl.h;
                }
                
                //改变大小
                objsize.height = JQuery_UITool_ResizeControl.h+bstep;
            }
            
            //执行resizeMoveFun 
            var resizeMoveRet = true;
            var newobjpos = {left:objpos.left,top:objpos.top};
            var newobjsize = {width:objsize.width,height:objsize.height};
            if(JQuery_UITool_ResizeControl.opts.resizeType == "div"){
                newobjpos.left = objpos.left - JQuery_UITool_ResizeControl.l + JQuery_UITool_ResizeControl.ol;
                newobjpos.top = objpos.top - JQuery_UITool_ResizeControl.t + JQuery_UITool_ResizeControl.ot;
                newobjsize.width = objsize.width - JQuery_UITool_ResizeControl.w + JQuery_UITool_ResizeControl.ow;
                newobjsize.height = objsize.height - JQuery_UITool_ResizeControl.h + JQuery_UITool_ResizeControl.oh;
            }
            if(JQuery_UITool_ResizeControl.opts.resizeMoveFun != null){
                try{
                    resizeMoveRet = JQuery_UITool_ResizeControl.opts.resizeMoveFun(JQuery_UITool_ResizeControl,JQuery_UITool_ResizeControl.opts,event,newobjpos,newobjsize);
                }catch(e){;}
            }
            
            if(resizeMoveRet){
                //改变大小
                JQuery_UITool_ResizeControl.showObj.css({left:objpos.left+"px",top:objpos.top+"px",width:objsize.width+"px",height:objsize.height+"px"});
            }
        }
    };

    /*
    --ResizeControl_EndResize--
    内部函数，松开鼠标时释放对象
    */
    var ResizeControl_EndResize = function(){
        if(JQuery_UITool_ResizeControl != null && JQuery_UITool_ResizeControl.Resizing == true){
            JQuery_UITool_ResizeControl.Resizing = false;
            JQuery_UITool_ResizeControl.children("[selftype='ResizeControl']").get(0).releaseCapture(); //释放鼠标
            
            //执行confirmResizeFun 参数：对象本身、改变大小参数、event（mousemove）、objpos{left,top}、objsize{width,height}
            var confirmRet = true;
            var objpos = {left:parseInt(JQuery_UITool_ResizeControl.showObj.css("left").slice(0,-2)),top:parseInt(JQuery_UITool_ResizeControl.showObj.css("top").slice(0,-2))};
            var objsize = {width:JQuery_UITool_ResizeControl.showObj.width(),height:JQuery_UITool_ResizeControl.showObj.height()};
            var newobjpos = {left:objpos.left,top:objpos.top};
            var newobjsize = {width:objsize.width,height:objsize.height};
            if(JQuery_UITool_ResizeControl.opts.resizeType == "div"){
                newobjpos.left = objpos.left - JQuery_UITool_ResizeControl.l + JQuery_UITool_ResizeControl.ol;
                newobjpos.top = objpos.top - JQuery_UITool_ResizeControl.t + JQuery_UITool_ResizeControl.ot;
                newobjsize.width = objsize.width - JQuery_UITool_ResizeControl.w + JQuery_UITool_ResizeControl.ow;
                newobjsize.height = objsize.height - JQuery_UITool_ResizeControl.h + JQuery_UITool_ResizeControl.oh;
            }
            if(JQuery_UITool_ResizeControl.opts.confirmResizeFun != null){
                try{
                    confirmRet = JQuery_UITool_ResizeControl.opts.confirmResizeFun(JQuery_UITool_ResizeControl,JQuery_UITool_ResizeControl.opts,event,newobjpos,newobjsize);
                }catch(e){;}
            }
            
            
            if(JQuery_UITool_ResizeControl.opts.resizeType == "div"){
                if(confirmRet){
                    //修改对象位置和大小
                    JQuery_UITool_ResizeControl.css({left:newobjpos.left+"px",top:newobjpos.top+"px",width:newobjsize.width+"px",height:newobjsize.height+"px"});
                }
                
                //删除辅助对象
                JQuery_UITool_ResizeControl.showObj.remove();
            }
            else{
                if(!confirmRet){
                     //不生效，恢复对象原来的位置
                    JQuery_UITool_ResizeControl.css({left:JQuery_UITool_ResizeControl.l+"px",top:JQuery_UITool_ResizeControl.t+"px",width:JQuery_UITool_ResizeControl.w+"px",height:JQuery_UITool_ResizeControl.h+"px"});
                }
            }
            
            //执行endResizeFun 参数依次为confirmResizeFun返回结果、对象本身、改变大小参数、event（mouseup）、objpos{left,top}、objsize{width,height}
            if(JQuery_UITool_ResizeControl.opts.endResizeFun != null){
                try{
                    JQuery_UITool_ResizeControl.opts.endResizeFun(confirmRet,JQuery_UITool_ResizeControl,JQuery_UITool_ResizeControl.opts,event,newobjpos,newobjsize);
                }catch(e){;}
            }
            
            JQuery_UITool_ResizeControl = null;
            
            //解除绑定事件
            $(document.body).unbind("mousemove",ResizeControl_MouseMove);
            $(document.body).unbind("mouseup",ResizeControl_EndResize);
            $(document.body).unbind("mousedown",ResizeControl_EndResize);
        }
    };
    
})(jQuery);

