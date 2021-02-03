/*-----------------------
JQuery-UITool v1.0.0
完成时间：2011-
作者：黎慧剑
联系方式:snakeclub@163.com
程序说明：基于JQuery框架的Web界面便捷工具,基于该工具，可以通过简单的函数调用实现各类Web界面效果，简化Web开发

当前控件：DragControl
说明：窗口拖拽控制，支持同时拖拽多个对象，但前提是对象样式的position为absolute
文件：DragControl.js
依赖文件：jquery-1.6.4.min.js
          ToolFunction.js
修改说明:
2021.1.15 by 黎慧剑:
1、修正chrome错误 setCapture/releaseCapture is not a function
2、添加拖动时不改变鼠标样式的参数
-----------------------*/

/*-----------------------
==DragControl==
窗口拖拽控制，支持同时拖拽多个对象，但前提是对象样式的position为absolute
-----------------------*/
;(function($) {
    /*
    --JQuery_UITool_DragControl--
    通用的托拽公用变量，注意调用界面不能使用这个变量
    */
    var JQuery_UITool_DragControl = null;

    /*
      --$.DragControl.defaults--
      托拽事件的默认参数，可以通过修改该默认参数来令所有托拽事件的参数变更
    */
    $.DragControl = new Object();
    $.DragControl.defaults = {
        //直接移动对象还是移动透明复制对象，默认为false-直接移动对象
        moveCopy : false,

        //透明复制对象的透明度
        opacity : 50,

        //是否在页面上自由移动，true-将对象的父节点修改为document.body，并将position设置为absolute，并进行拖动；false-在对象的原父节点层中移动对象，默认为false
        overPage : false,

        //是否自动停止拖动，若为true则在mouseup时停止拖动，若为false则需执行$.EndDrag()来结束拖动
        autoEndDrag : true,

        //拖动时是否改变光标
        changeDragCursor: true,

        //拖动时光标的样式
        dragCursor : "move",

        //拖拽开始前执行的函数，传入的参数为：JQuery_UITool_DragControl；函数必须返回true/fasle，若返回false则不执行拖动操作
        beginDragFun : null,

        //拖拽过程中鼠标移动时执行的函数，传入参数为JQuery_UITool_DragControl、event；函数必须返回true/fasle，若返回false则不执行对象位置的变化动作
        mouseMoveFun: null,

        //托拽过程中鼠标在匹配对象上移动时执行的函数,传入的参数为：JQuery_UITool_DragControl、移动上的对象、event
        mouseOverFun : null,

        //托拽过程中鼠标移出匹配对象时执行的函数,传入的参数为：JQuery_UITool_DragControl、移出的对象、event
        mouseOutFun : null,

        //DragControl_EndDrag()时执行的确认函数，可在函数中增加确认判断条件来确定拖动是否最终生效。传入的参数为JQuery_UITool_DragControl、移动上的对象。函数必须返回true/fasle，若返回false则代表拖动无效，将对象置回原位置
        confirmFun : null,

        //拖动结束后执行的函数，传入的参数为：是否生效、拖动对象的清单，结束拖动时鼠标位置上匹配到的dragOn对象
        endDragFun : null,

        //鼠标移动上或结束拖动时判断鼠标位置上匹配到对象的参数，参见ToolFunction中的$.getObjByPos函数
        dragOnObjPara : {
            //搜索的根节点（最顶层节点）
            rootObj : $(document.body),

            //搜索结果是否包含根节点
            withRoot : false,

            //搜索的jquery条件
            jqueryStr : "*",

            //搜索方向,root - 根节点开始往下搜索，child - 子节点往根节点方向，该参数只有在justFirst为true时才有效
            searchPath : "child",

            //是否只返回第1个匹配节点
            justFirst : true
        }
    };

    /*
      --Drag--
      开始拖拽对象，可以在对象的onmousedown中加入代码$(this).Drag();来拖动一个对象，也可以在某一个事件中加入$("").Drag();来拖动一批对象
    */
    $.fn.Drag = function(opts) {
        if(this.length == 0){
            return;
        }
        //自定义参数
	    opts = $.extend({}, $.DragControl.defaults, opts || {});

	    //将参数存入公共变量里
        JQuery_UITool_DragControl = new Object();
        JQuery_UITool_DragControl.Moving = false;
        JQuery_UITool_DragControl.opts = opts;
        JQuery_UITool_DragControl.List = new Array(this.length);
        //list
        for(var i = 0;i<this.length;i++){
             JQuery_UITool_DragControl.List[i] = new Object();
             JQuery_UITool_DragControl.List[i].Obj = $(this.get(i));  //原始对象的实例
             JQuery_UITool_DragControl.List[i].OrgObj = $(this.get(i)).clone(true);  //保留原始对象的复制变量，用于恢复原来位置
        }

        //执行移动开始前的处理
        if(opts.beginDragFun != null){
            try{
                if(!opts.beginDragFun(JQuery_UITool_DragControl)){
                    return;
                }
            }
            catch(e){
                return;
            }
        }

        JQuery_UITool_DragControl.Moving = true;

        //记录鼠标位置
        JQuery_UITool_DragControl.startX = event.clientX + $(document).scrollLeft();
        JQuery_UITool_DragControl.startY = event.clientY + $(document).scrollTop();
        JQuery_UITool_DragControl.X = JQuery_UITool_DragControl.startX;
        JQuery_UITool_DragControl.Y = JQuery_UITool_DragControl.startY;
        JQuery_UITool_DragControl.LastCursor = $(document.body).css("cursor");

        //改变光标
        if (opts.changeDragCursor){
            $(document.body).css("cursor",opts.dragCursor);
        }

        //循环处理对象
        for(var i = 0; i<this.length;i++){
            //记录原始位置信息
            JQuery_UITool_DragControl.List[i].OrgObj.parent = $(this.get(i).parentNode);

            //如果是页面范围的，需要修改位置属性
            if(opts.overPage){
                var voffset = $(this.get(i)).offset();
                if(!opts.moveCopy){
                    JQuery_UITool_DragControl.List[i].Obj = $(this.get(i)).clone(true);
                    JQuery_UITool_DragControl.List[i].Obj.css({position:"absolute",left:voffset.left+"px",top:voffset.top+"px"});
                    $(document.body).append(JQuery_UITool_DragControl.List[i].Obj);
                    $(this.get(i)).remove();
                }
                JQuery_UITool_DragControl.List[i].Obj.startL = voffset.left;
                JQuery_UITool_DragControl.List[i].Obj.startT =  voffset.top;
                JQuery_UITool_DragControl.List[i].Obj.L = voffset.left;
                JQuery_UITool_DragControl.List[i].Obj.T = voffset.top;
            }
            else{
                //不在页面层面移动
                JQuery_UITool_DragControl.List[i].Obj.startL = parseInt(JQuery_UITool_DragControl.List[i].Obj.css("left").slice(0,-2));
                JQuery_UITool_DragControl.List[i].Obj.startT = parseInt(JQuery_UITool_DragControl.List[i].Obj.css("top").slice(0,-2));
                JQuery_UITool_DragControl.List[i].Obj.L = JQuery_UITool_DragControl.List[i].Obj.startL;
                JQuery_UITool_DragControl.List[i].Obj.T = JQuery_UITool_DragControl.List[i].Obj.startT;
            }

            //copy对象
            if(opts.moveCopy){
                var copy = JQuery_UITool_DragControl.List[i].Obj.clone();
                var zindex = JQuery_UITool_DragControl.List[i].Obj.css("z-index");
                if(zindex == "auto"){
                    zindex = "0";
                }
                //去掉id，并设置透明度  opacity:"+(opacity/100)+"; filter: alpha(opacity="+opacity+");
                copy.removeAttr("id");
                copy.css({opacity:opts.opacity/100, filter:"alpha(opacity="+opts.opacity+")"});
                copy.css("z-index",999+parseInt(zindex));

                //去掉所有子对象的id属性
                copy.find("[id]").removeAttr("id");
                //加入到dom中
                if(opts.overPage){
                    copy.css({position:"absolute",left:JQuery_UITool_DragControl.List[i].Obj.startL+"px",top:JQuery_UITool_DragControl.List[i].Obj.startT+"px"});
                    $(document.body).append(copy);
                }
                else{
                    copy.insertAfter(JQuery_UITool_DragControl.List[i].Obj);
                }
                //加入清单
                JQuery_UITool_DragControl.List[i].CopyObj = copy;
            }
        }
        JQuery_UITool_DragControl.List[0].Obj.get(0).setCapture;

         //绑定窗体的鼠标移动和鼠标松开按钮
         $(document.body).bind("mousemove",DragControl_MouseMove);
         if(opts.autoEndDrag){
            $(document.body).bind("mouseup",DragControl_EndDrag);
         }
    };

    /*
      --EndDrag--
      结束拖拽对象
    */
    $.EndDrag = function(){
        DragControl_EndDrag();
    };

    /*
    --DragControl_MouseMove--
    内部函数，拖拽时移动鼠标时所执行的函数
    */
    function DragControl_MouseMove() {
        if(JQuery_UITool_DragControl != null && JQuery_UITool_DragControl.Moving == true){
            //记录当前状态
            JQuery_UITool_DragControl.X = event.clientX + $(document).scrollLeft();
            JQuery_UITool_DragControl.Y = event.clientY + $(document).scrollTop();

            //执行mouseMoveFun
            var retMove = true;
            if(JQuery_UITool_DragControl.opts.mouseMoveFun != null){
                try{
                    retMove = JQuery_UITool_DragControl.opts.mouseMoveFun(JQuery_UITool_DragControl,event);
                }catch(e){;}
            }

            //处理对象的位置变化，对每个对象都处理，当然是在mouseMoveFun返回true的情况
            if(retMove){
                for(var i = 0; i < JQuery_UITool_DragControl.List.length; i++){
                    //X方向
                    if(!isNaN(JQuery_UITool_DragControl.List[i].Obj.startL)){
                        JQuery_UITool_DragControl.List[i].Obj.L = JQuery_UITool_DragControl.X - JQuery_UITool_DragControl.startX + JQuery_UITool_DragControl.List[i].Obj.startL;
                        if(JQuery_UITool_DragControl.opts.moveCopy)
                            JQuery_UITool_DragControl.List[i].CopyObj.css("left",JQuery_UITool_DragControl.List[i].Obj.L);
                        else
                            JQuery_UITool_DragControl.List[i].Obj.css("left",JQuery_UITool_DragControl.List[i].Obj.L);
                    }

                    //Y方向
                    if(!isNaN(JQuery_UITool_DragControl.List[i].Obj.startT)){
                        JQuery_UITool_DragControl.List[i].Obj.T = JQuery_UITool_DragControl.Y - JQuery_UITool_DragControl.startY + JQuery_UITool_DragControl.List[i].Obj.startT;
                        if(JQuery_UITool_DragControl.opts.moveCopy)
                            JQuery_UITool_DragControl.List[i].CopyObj.css("top",JQuery_UITool_DragControl.List[i].Obj.T);
                        else
                            JQuery_UITool_DragControl.List[i].Obj.css("top",JQuery_UITool_DragControl.List[i].Obj.T);
                    }
                }
            }

            //判断是否需执行鼠标移动函数
            if(JQuery_UITool_DragControl.opts.mouseOverFun != null || JQuery_UITool_DragControl.opts.mouseOutFun != null){
                var dragOnObjects = $.getObjByPos(event.clientX,event.clientY,JQuery_UITool_DragControl.opts.dragOnObjPara);
                if(dragOnObjects.length == 0){
                    //没有匹配到任何对象，对原来的对象执行mouseOutFun即可
                    if(JQuery_UITool_DragControl.MouseOverTempObj != null && JQuery_UITool_DragControl.opts.mouseOutFun != null){
                        try{
                            JQuery_UITool_DragControl.opts.mouseOutFun(JQuery_UITool_DragControl,JQuery_UITool_DragControl.MouseOverTempObj,event);
                        }
                        catch(e){;}
                    }
                    JQuery_UITool_DragControl.MouseOverTempObj = null;
                }
                else{
                    //匹配到对象,由于jquery的搜索模式是自上而下，因此最后一个对象就是最内层的那个
                    if(JQuery_UITool_DragControl.MouseOverTempObj != null && JQuery_UITool_DragControl.MouseOverTempObj.get(0) == dragOnObjects.get(dragOnObjects.length - 1)){
                        //新对象和原对象一致
                        return;
                    }

                    if(JQuery_UITool_DragControl.MouseOverTempObj != null && JQuery_UITool_DragControl.opts.mouseOutFun != null){
                        //执行mouseOutFun
                        try{
                            JQuery_UITool_DragControl.opts.mouseOutFun(JQuery_UITool_DragControl,JQuery_UITool_DragControl.MouseOverTempObj,event);
                        }
                        catch(e){;}
                    }

                    JQuery_UITool_DragControl.MouseOverTempObj = $(dragOnObjects.get(dragOnObjects.length - 1));

                    if(JQuery_UITool_DragControl.opts.mouseOverFun != null){
                        //执行mouseOverFun
                        try{
                            JQuery_UITool_DragControl.opts.mouseOverFun(JQuery_UITool_DragControl,JQuery_UITool_DragControl.MouseOverTempObj,event);
                        }
                        catch(e){;}
                    }
                }
            }
        }
    };

    /*
    --DragControl_EndDrag--
    内部函数，松开鼠标时释放对象
    */
    function DragControl_EndDrag(){
        if(JQuery_UITool_DragControl != null && JQuery_UITool_DragControl.Moving == true){
            JQuery_UITool_DragControl.Moving = false;
            JQuery_UITool_DragControl.List[0].Obj.get(0).releaseCapture; //释放鼠标

            //解除绑定事件
            $(document.body).unbind("mousemove",DragControl_MouseMove);
            $(document.body).unbind("mouseup",DragControl_EndDrag);
            $(document.body).unbind("mousedown",DragControl_EndDrag);

            //释放鼠标时的dropon对象
            var dragOnObjects = $.getObjByPos(event.clientX,event.clientY,JQuery_UITool_DragControl.opts.dragOnObjPara);

            //执行确认函数
            var confirmret = true;
            if(JQuery_UITool_DragControl.opts.confirmFun != null){
                try{
                    confirmret = JQuery_UITool_DragControl.opts.confirmFun(JQuery_UITool_DragControl,dragOnObjects);
                }catch(e){
                    confirmret = false;
                }
            }

            //如果是copy模式，删除copy对象
            if(JQuery_UITool_DragControl.opts.moveCopy){
                for(var i = 0;i<JQuery_UITool_DragControl.List.length;i++){
                    JQuery_UITool_DragControl.List[i].CopyObj.remove();
                }
            }

            if(confirmret){
                //确认生效
                if(JQuery_UITool_DragControl.opts.moveCopy){
                    for(var i = 0;i<JQuery_UITool_DragControl.List.length;i++){
                        JQuery_UITool_DragControl.List[i].Obj.css({left:JQuery_UITool_DragControl.List[i].Obj.L+"px",top:JQuery_UITool_DragControl.List[i].Obj.T+"px"});
                        if(JQuery_UITool_DragControl.opts.overPage){
                            //移到document上
                            JQuery_UITool_DragControl.List[i].Obj.css("position","absolute");
                            var copy = JQuery_UITool_DragControl.List[i].Obj.clone(true);
                            $(document.body).append(copy);
                            JQuery_UITool_DragControl.List[i].Obj.remove();
                        }
                    }
                }
            }
            else{
                //不生效
                if(!JQuery_UITool_DragControl.opts.moveCopy){
                    for(var i = 0;i<JQuery_UITool_DragControl.List.length;i++){
                        if(JQuery_UITool_DragControl.opts.overPage){
                            //恢复原来的位置
                            JQuery_UITool_DragControl.List[i].Obj.remove();
                            JQuery_UITool_DragControl.List[i].OrgObj.parent.append(JQuery_UITool_DragControl.List[i].OrgObj);
                        }
                        else{
                            JQuery_UITool_DragControl.List[i].Obj.css({left:JQuery_UITool_DragControl.List[i].OrgObj.css("left"),top:JQuery_UITool_DragControl.List[i].OrgObj.css("top"),position:JQuery_UITool_DragControl.List[i].OrgObj.css("position")});
                        }
                    }
                }
            }

            //执行处理函数
            if(JQuery_UITool_DragControl.opts.endDragFun != null){
                try{
                    JQuery_UITool_DragControl.opts.endDragFun(confirmret,JQuery_UITool_DragControl,dragOnObjects);
                }
                catch(e){
                    ;
                }
            }

            //将光标修改回来
            if(JQuery_UITool_DragControl.opts.changeDragCursor){
                $(document.body).css("cursor",JQuery_UITool_DragControl.LastCursor);
            }

            //结束处理
            JQuery_UITool_DragControl = null;
            return;
        }
    };


})(jQuery);
