/*-----------------------
JQuery-UITool v1.0.0
完成时间：2011-
作者：黎慧剑
联系方式:snakeclub@163.com
程序说明：基于JQuery框架的Web界面便捷工具,基于该工具，可以通过简单的函数调用实现各类Web界面效果，简化Web开发

当前控件：ToolFunction
说明：提供一些常用的工具函数，简化开发
文件：ToolFunction.js
依赖文件：jquery-1.6.4.min.js
-----------------------*/
/*-----------------------
==ToolFunction==
常用工具函数
-----------------------*/
;(function($) {
/*---------------
--isFunKeyCode--
检查event.keyCode是否退格等控制字符
--------------- */
$.isFunKeyCode = function(ev)
{
    var keynum;
    if(window.event) //IE
    {
        keynum = ev.keyCode;
    }
    else  //Netscape/Firefox/Opera
    {
        keynum = ev.which;
    }
    
	if((keynum > 34 && keynum < 41) || keynum == 20 || keynum == 27 || keynum == 8)
    {
      return true;
    }
    return false;
};

/*---------------
--sortNumberAsc--
数组排序时按数字升序排序的调用函数，主要是Array对象的sort()方法调用
使用方法： var arr = new Array(6);  ... var newarr = arr.sort(sortNumberAsc);
--------------- */
$.sortNumberAsc = function(a,b)
{
    return a - b;
};

/*---------------
--sortNumberDesc--
数组排序时按数字降序排序的调用函数，主要是Array对象的sort()方法调用
使用方法： var arr = new Array(6);  ... var newarr = arr.sort(sortNumberDesc);
--------------- */
$.sortNumberDesc = function(a,b)
{
    return b - a;
};

 /*
  --getElementPos--
  获得对象的位置信息,使用方法：var pos = $("#exejs").getElementPos();alert(pos.x + ":" + pos.y);
  */
  $.fn.getElementPos = function() {
        if(this.length == 0){
            return false;
        }
        
        var ua = navigator.userAgent.toLowerCase();
         var isOpera = (ua.indexOf('opera') != -1);
         var isIE = (ua.indexOf('msie') != -1 && !isOpera); // not opera spoof
         var el = this.get(0);
         if(el.parentNode === null || el.style.display == 'none') {
          return false;
         }      
         var parent = null;
         var pos = [];     
         var box;     
         if(el.getBoundingClientRect)    //IE
         {         
          box = el.getBoundingClientRect();
          var scrollTop = Math.max(document.documentElement.scrollTop, document.body.scrollTop);
          var scrollLeft = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
          return {x:box.left + scrollLeft, y:box.top + scrollTop};
         }else if(document.getBoxObjectFor)    // gecko    
         {
          box = document.getBoxObjectFor(el); 
          var borderLeft = (el.style.borderLeftWidth)?parseInt(el.style.borderLeftWidth):0; 
          var borderTop = (el.style.borderTopWidth)?parseInt(el.style.borderTopWidth):0; 
          pos = [box.x - borderLeft, box.y - borderTop];
         } else    // safari & opera    
         {
          pos = [el.offsetLeft, el.offsetTop];  
          parent = el.offsetParent;     
          if (parent != el) { 
           while (parent) {  
            pos[0] += parent.offsetLeft; 
            pos[1] += parent.offsetTop; 
            parent = parent.offsetParent;
           }  
          }   
          if (ua.indexOf('opera') != -1 || ( ua.indexOf('safari') != -1 && el.style.position == 'absolute' )) { 
           pos[0] -= document.body.offsetLeft;
           pos[1] -= document.body.offsetTop;         
          }    
         }              
         if (el.parentNode) { 
            parent = el.parentNode;
           } else {
            parent = null;
           }
         while (parent && parent.tagName != 'BODY' && parent.tagName != 'HTML') { // account for any scrolled ancestors
          pos[0] -= parent.scrollLeft;
          pos[1] -= parent.scrollTop;
          if (parent.parentNode) {
           parent = parent.parentNode;
          } else {
           parent = null;
          }
         }
         return {x:pos[0], y:pos[1]};
  };
  
  /*
  --getScrollLeftWidth--
  获得对象左右滚动条的宽度，若宽度为0则代表无滚动条
  */
  $.fn.getScrollLeftWidth = function(){
      var objdom = this.get(0);
      if(objdom == window || objdom == document || objdom == document.body){
          if($(document).scrollLeft() == 0){
             //可能没有滚动条
             $(document).scrollLeft(1); //滚动一下，用于判断是否有滚动条
             if($(document).scrollLeft() == 0){
                return 0;
             }
             //恢复原来的滚动情况
             $(document).scrollLeft(0);
          }
          //确定有滚动条，暂时没有计算滚动条宽度的办法
          return 16;
      }
      else{
        //一般对象
        var obj = $(objdom);
        if(obj.css("overflow-x") == "hidden"){
            //设置了隐藏
            return 0;
        }
        
        //还是采取滚动的方式判断是否有滚动条
        if(obj.scrollLeft() == 0){
            obj.scrollLeft(1); //滚动一下，用于判断是否有滚动条
             if(obj.scrollLeft() == 0){
                return 0;
             }
             //恢复原来的滚动情况
             obj.scrollLeft(0);
        }
        //确定有滚动条
        var topborder = parseInt($(objdom).css("border-top-width").slice(0,-2));
        var bottomborder = parseInt($(objdom).css("border-bottom-width").slice(0,-2));
        return objdom.offsetHeight - objdom.clientHeight - (isNaN(topborder)?0:topborder) - (isNaN(bottomborder)?0:bottomborder);  //这里offsetHeight把边框算进去了,把边框去掉就可以了
      }
  };
  
  /*
  --getScrollTopWidth--
  获得对象上下滚动条的宽度，若宽度为0则代表无滚动条
  */
  $.fn.getScrollTopWidth = function(){
      var objdom = this.get(0);
      if(objdom == window || objdom == document || objdom == document.body){
          if($(document).scrollTop() == 0){
             //可能没有滚动条
             $(document).scrollTop(1); //滚动一下，用于判断是否有滚动条
             if($(document).scrollTop() == 0){
                return 0;
             }
             //恢复原来的滚动情况
             $(document).scrollTop(0);
          }
          //确定有滚动条，暂时没有计算滚动条宽度的办法
          return 16;
      }
      else{
        //一般对象
        var obj = $(objdom);
        if(obj.css("overflow-y") == "hidden"){
            //设置了隐藏
            return 0;
        }
        //还是采取滚动的方式判断是否有滚动条
        if(obj.scrollTop() == 0){
            obj.scrollTop(1); //滚动一下，用于判断是否有滚动条
             if(obj.scrollTop() == 0){
                return 0;
             }
             //恢复原来的滚动情况
             obj.scrollTop(0);
        }
        
        //确定有滚动条
        var leftborder = parseInt($(objdom).css("border-left-width").slice(0,-2));
        var rightborder = parseInt($(objdom).css("border-right-width").slice(0,-2));
        return objdom.offsetWidth - objdom.clientWidth - (isNaN(leftborder)?0:leftborder) - (isNaN(rightborder)?0:rightborder);  //这里offsetHeight把边框算进去了,把边框去掉就可以了
      }
  };
  
  /*
  --scrollToCenter--
  通过滚动条将指定对象显示到Windows窗口的正中
  */
  $.fn.scrollToCenter = function() {
    if(this.length == 0 || this.get(0) == document.body || this.get(0) == document){
        return;
    }
    //记录对象的信息
    var obj = $(this.get(0));
    var objwidth = obj.outerWidth(true);
    var objheight = obj.outerHeight(true);
    
    //中间用到的临时变量
    var parentobj = $(obj.get(0).parentNode);  //获得父节点
    var childobj = obj;
    //偏移量
    var offsetleft = 0;
    var offsettop = 0;
    //临时变量
    var centerleft = 0;
    var centertop = 0;
    var realleft = 0;
    var realtop = 0;
    var objpos = null;
    var parentobjpos = null;
    var scrollleftwidth = 0;
    var scrolltopwidth = 0;
    
    //开始循环进行处理，统一通过offset来定位处理
    while(true){
        objpos = obj.offset();
        parentobjpos = parentobj.offset();
        
        //左右的滚动条
        scrollleftwidth = parentobj.getScrollLeftWidth();
        parentobjwidth = (parentobj.get(0) != document.body) ? (parentobj.innerWidth() - scrollleftwidth) : $(window).width(); //去掉滚动条的位置
        centerleft = Math.floor((parentobjwidth - objwidth)/2);
        if(scrollleftwidth > 0){
            //有滚动条才处理
            if(parentobj.get(0) != document.body){
                realleft = objpos.left - parentobjpos.left - centerleft + parentobj.scrollLeft();
                parentobj.scrollLeft(realleft);
            }
            else{
                //已经到最后的节点了，应直接与obj比较
                realleft = objpos.left - centerleft;
                $(document).scrollLeft(realleft);
            }
        }
        
        //上下的滚动条
        scrolltopwidth = parentobj.getScrollTopWidth();
        parentobjheight = (parentobj.get(0) != document.body) ? (parentobj.innerHeight() - scrolltopwidth) : $(window).height();
        centertop = Math.floor((parentobjheight-objheight)/2);
        if(scrolltopwidth > 0){
            //有滚动条才处理
            if(parentobj.get(0) != document.body){
                realtop = objpos.top - parentobjpos.top - centertop + parentobj.scrollTop();
                parentobj.scrollTop(realtop);
            }
            else{
                //已经到最后的节点了，应直接与obj比较
                realtop = objpos.top - centertop;
                $(document).scrollTop(realtop);
            }
        }
        //如果已经处理到最后一层
        if(parentobj.get(0) == document.body){
            return;
        }

        //再处理下一个节点
        childobj = parentobj;
        parentobj = $(parentobj.get(0).parentNode);
    }
  };
  
/*---------------
--getWindowSize--
获得浏览器显示区域的大小
--------------- */
$.getWindowSize = function()
{
    //要返回的值
    var ret = new Object();   
    //创建临时对象 
    $(document.body).append("<div id='getWindowSize_Temp' style='font-size:0px; width:0px; height:0px; position:absolute; right:0px; bottom:0px; border:0px solid #000;'></div>");
    var pos = $("#getWindowSize_Temp").offset();
    if($.browser.msie && parseFloat($.browser.version) < 7){
        ret.width = pos.left - $(document).scrollLeft();
        ret.height = pos.top - $(document).scrollTop();
    }
    else{
        ret.width = pos.left;
        ret.height = pos.top;
    }
    //删除临时对象
    $("#getWindowSize_Temp").remove();
    return ret;
};

/*---------------
--getObjByPos--
根据位置参数获取JQuery对象
--------------- */
$.getObjByPos = function(x,y,opts){
    //处理参数
    var DefaultOpts = {
        //搜索的根节点（最顶层节点）
        rootObj : $(document.body),
        
        //搜索结果是否包含根节点
        withRoot : false,
        
        //搜索的jquery条件
        jqueryStr : "*",
        
        //搜索方向,root - 根节点开始往下搜索，child - 子节点往根节点方向，该参数只有在justFirst为true时才有效
        searchPath : "child",
        
        //是否只返回第1个匹配节点
        justFirst : true,
        
        //位置参照,"event" - event事件的clientX和clientY，"document" - 页面中的位置，JQueryObj-指定的jquery对象
        posPara : "event"
    };
    opts = $.extend({}, DefaultOpts, opts || {});
    
    //将鼠标位置转换为相对于document的位置
    var MouseX = x, MouseY = y; 
    if(opts.posPara.jquery !== undefined){
        //是jquery对象
        var tempoffset = opts.posPara.offset();
        MouseX = tempoffset.left + x;
        MouseY = tempoffset.top + y;
    }
    else if(opts.posPara != "document"){
        //event的情况
        MouseX = x + $(document).scrollLeft();
        MouseY = y + $(document).scrollTop();
    }
    
    //开始处理
    var QueryObjects = $("");
    if(!opts.justFirst){
        //查找所有匹配的对象
        var tempObjs = opts.rootObj.find(opts.jqueryStr);
        if(opts.withRoot && opts.rootObj.is(opts.jqueryStr)){
            //加上自身
            tempObjs = tempObjs.add(opts.rootObj);
        }
        //判断位置是否满足
        for(var i = 0;i<tempObjs.length;i++){
            var obj = $(tempObjs.get(i));
            var objpos = obj.getElementPos();
            if(MouseX >= objpos.x && MouseX <= objpos.x+obj.outerWidth() && MouseY >= objpos.y && MouseY <= objpos.y+obj.outerHeight()){
                //匹配上
                QueryObjects = QueryObjects.add(tempObjs.get(i));
            }
        }
    }
    else{
        //只查找匹配的第1个对象
        if(opts.searchPath == "root"){
            QueryObjects = getObjByPos_SearchFromRoot((opts.withRoot ? opts.rootObj : opts.rootObj.children()),opts,MouseX,MouseY);
        }
        else{
            QueryObjects = getObjByPos_SearchFromChild((opts.withRoot ? opts.rootObj : opts.rootObj.children()),opts,MouseX,MouseY);
        }
    }
    
    //返回结果
    return QueryObjects;
};


/*---------------
--$.getStyleSheetsStyle--
获得css文件中定义的样式值
--------------- */
$.getStyleSheetsStyle = function(cssname,stylename){
    var rss;
    var style;
    var value;
    for(var i = 0;i<document.styleSheets.length;i++){
        var tar = document.styleSheets[i];
        rss = tar.cssRules?tar.cssRules:tar.rules;
        for(var j=0;j<rss.length;j++)
        {
            style = rss[j];
            if(style.selectorText.toLowerCase() == cssname.toLowerCase())
            {
                //修改style
                while(true){
                    var pos = stylename.indexOf("-");
                    if(pos < 0){
                        break;
                    }
                    stylename = stylename.substring(0,pos)+stylename[pos+1].toUpperCase()+stylename.substring(pos+2);
                }
                value = style.style[stylename];
                return value;
            }
        }
    }
    
    return value;
};

/*---------------
--$.getRequest--
获得css文件中定义的样式值
--------------- */
$.getRequest = function(paraName){
    var url = location.href; 
    if(url.indexOf("?") == -1 || url.indexOf("=") == -1){
        return undefined;
    }
    
    var paraString = url.substring(url.indexOf("?")+1,url.length).split("&"); 
    var paraObj = {} 
    for (i=0; j=paraString[i]; i++){ 
        paraObj[j.substring(0,j.indexOf("="))] = j.substring(j.indexOf("=")+1,j.length); 
    }
    
    if(arguments.length == 0){
        return paraObj;
    }
    else{
        return paraObj[paraName]; 
    }
};


/*---------------
--getObjByPos_SearchFromRoot--
内部函数，getObjByPos需要用到的递归处理函数--针对justFirst为true，且从根节点开始的情况
--------------- */
function getObjByPos_SearchFromRoot(firstObjs,opts,MouseX,MouseY){
    var QueryObjects = $("");
    //对传入的对象先匹配
    for(var i = 0;i<firstObjs.length;i++){
        var obj = $(firstObjs.get(i));
        if(obj.is(opts.jqueryStr)){
            //与搜索条件一致
            var objpos = obj.getElementPos();
            if(MouseX >= objpos.x && MouseX <= objpos.x+obj.outerWidth() && MouseY >= objpos.y && MouseY <= objpos.y+obj.outerHeight()){
                //当前的对象匹配上了，无需再进行后续的匹配
                return obj;
            }
        }
        else{
            //搜索子节点
            QueryObjects = getObjByPos_SearchFromRoot(obj.children(),opts,MouseX,MouseY);
            if(QueryObjects.length > 0){
                //在子对象中匹配到了
                return QueryObjects;
            }
        }
    }
    
    //没有匹配到任何对象
    return QueryObjects;
};

/*---------------
--getObjByPos_SearchFromChild--
内部函数，getObjByPos需要用到的递归处理函数--针对justFirst为true，且从子节点开始的情况
--------------- */
function getObjByPos_SearchFromChild(firstObjs,opts,MouseX,MouseY){
    var QueryObjects = $("");
    
    //先匹配传入对象的子节点
    for(var i = 0;i<firstObjs.length;i++){
        var obj = $(firstObjs.get(i));
        //搜索子节点
        QueryObjects = getObjByPos_SearchFromChild(obj.children(),opts,MouseX,MouseY);
        if(QueryObjects.length > 0){
            //已经找到子节点了
            return QueryObjects;
        }
        //子节点找不到，再判断自身
        if(obj.is(opts.jqueryStr)){
            //与搜索条件一致
            var objpos = obj.getElementPos();
            if(MouseX >= objpos.x && MouseX <= objpos.x+obj.outerWidth() && MouseY >= objpos.y && MouseY <= objpos.y+obj.outerHeight()){
                //当前的对象匹配上了，无需再进行后续的匹配
                return obj;
            }
        }
    }
    
    //没有匹配到任何对象
    return QueryObjects;
};


/*---------------
--$.checkHover--
检查鼠标的mouseover和mouseout是否指定对象的真正Hover（在指定对象外面）
--------------- */
$.checkHover = function(e,domobj){
    if (getEvent(e).type == "mouseover") {  
        return !contains(domobj, getEvent(e).relatedTarget  
                || getEvent(e).fromElement)  
                && !((getEvent(e).relatedTarget || getEvent(e).fromElement) === domobj);  
    } else {  
        return !contains(domobj, getEvent(e).relatedTarget  
                || getEvent(e).toElement)  
                && !((getEvent(e).relatedTarget || getEvent(e).toElement) === domobj);  
    }  
};

/*---------------
--contains--
检查两个对象的上下级关系是否存在
--------------- */
function contains(parentNode, childNode) {  
    if (parentNode.contains) {  
        return parentNode != childNode && parentNode.contains(childNode);  
    } else {  
        return !!(parentNode.compareDocumentPosition(childNode) & 16);  
    }  
};

//取得当前window对象的事件   
function getEvent(e) {  
    return e || window.event;  
};


/*---------------
--$.cssAdapter--
Css样式表适配器，用于让所使用的样式表能兼容各种浏览器版本。该函数会在body标签上增加浏览器版本的Css样式标签（例如：<body class=’CssAdapter_IE6’>），这样在设计样式表的时候，可以用以下方法指定该浏览器版本的专有样式：
.CssAdapter_IE6  .你自己的样式名{…}
--------------- */
$.cssAdapter = function(){
    var cssName = "CssAdapter_";
    if($.browser.msie){
        //IE
        cssName += "IE";
        //版本
        var ver = $.browser.version;
        cssName += ver.split(".")[0];
    }
    
    $(document.body).addClass(cssName);
    
    /*
    if($.browser.webkit){
        //webkit
        
        return;
    }
    */
};

/*---------------
--$("").scrollWidth--
获得对象刚好不出现滚动条情况下的css宽度设置值
--------------- */
$.fn.scrollWidth = function(){
    if(this.length == 0)
        return 0;
    
    var obj = $(this.get(0));
    var laststyle = obj.attr("style");
    
    //设置为0
    obj.css("width","0px");
    obj.scrollLeft(3000000);
    var lastleft = obj.scrollLeft();
    obj.css("width",lastleft + "px");
    obj.scrollLeft(3000000);
    var left = obj.scrollLeft();
    while(left > 0){
        lastleft = lastleft + left;
        obj.css("width",lastleft + "px");
        obj.scrollLeft(3000000);
        left = obj.scrollLeft();
    }
    //恢复原来样式
    if(laststyle === undefined)
        obj.removeAttr("style");
    else
        obj.attr("style",laststyle);
        
    return lastleft;
};

/*---------------
--$("").scrollHeight--
获得对象刚好不出现滚动条情况下的css高度设置值
--------------- */
$.fn.scrollHeight = function(){
    if(this.length == 0)
        return 0;
    
    var obj = $(this.get(0));
    var laststyle = obj.attr("style");
    
    //设置为0
    obj.css("height","0px");
    obj.scrollTop(3000000);
    var lasttop = obj.scrollTop();
    obj.css("height",lasttop + "px");
    obj.scrollTop(3000000);
    var top = obj.scrollTop();
    while(top > 0){
        lasttop = lasttop + top;
        obj.css("height",lasttop + "px");
        obj.scrollTop(3000000);
        top = obj.scrollTop();
    }
    //恢复原来样式
    if(laststyle === undefined)
        obj.removeAttr("style");
    else
        obj.attr("style",laststyle);
    
    return lasttop;
};
  
})(jQuery);







