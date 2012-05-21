$.define("event", "node" ,function(){
    $.log("已加载event2模块")
    var rhoverHack = /(?:^|\s)hover(\.\S+)?\b/,  rmapper = /(\w+)_(\w+)/g,
    revent = /(^|_|:)([a-z])/g
    //如果不存在添加一个
    var facade = $.event = $.event || {};
    $.eventSupport = function( eventName,el ) {
        el = el || document.createElement("div");
        eventName = "on" + eventName;
        var ret = eventName in el;
        if ( el.setAttribute && !ret ) {
            el.setAttribute( eventName, "" );
            ret = typeof el[ eventName ] === "function";
            el.removeAttribute(eventName);
        }
        el = null;
        return ret;
    };
    $.log($.eventSupport("focusin"))
    //添加或增强二级属性eventAdapter
    $.Object.merge(facade,{
        eventAdapter:{
            focus: {
                delegateType: "focusin"
            },
            aaa: {
                bindType: "eee"
            },
            blur: {
                delegateType: "focusout"
            }
        }
    });
    var eventAdapter  = $.event.eventAdapter;
    var wrapper = function(hash){
        var fn = function(event){
            var ret = hash.callback.apply(hash.scope, arguments)
            if (ret === false) event.preventDefault()
            hash.times--;
            if(hash.times === 0){
                facade.unbind.call( hash.scope, hash)
            }
            return ret;
        }
        fn.uuid = hash.uuid;
        return fn;
    }
    function parseType(event, selector) {//"focusin.aaa.bbb"
        var parts = ('' + event).split('.');
        var ns = parts.slice(1).sort().join(' ');//aaa bbb
        var origType = parts[0];
        var adapter =  eventAdapter[ origType] || {}//focusin -> focus
        return {
            type : (selector ? adapter.delegateType : adapter.bindType ) || origType,//focus
            origType: origType,
            selector: selector,
            namespace: ns,
            rns: ns ? new RegExp("(^|\\.)" + ns.replace(' ', ' .* ?') + "(\\.|$)") : null
        }
    }
    //收集要移除的回调
    function findHandlers(hash, selector, fn, events) {
        return events.filter(function(item) {
            return item && (!hash.type  || hash.type === item.type) //通过事件类型进行过滤
            && (!hash.rns  || hash.rns.test(item.namespace)) //通过命名空间进行进行过滤
            && (!fn        || fn.uuid === item.uuid)//通过uuid进行过滤
            && (!selector  || selector === item.selector || selector === "**" && item.selector )//通过选择器进行过滤
        })
    }

    $.mix(facade,{
        bind: function( hash ){//hash 包含type callback times selector
            if( arguments.length > 1 ){
                throw "$.event bind method only need one argument, and it's a hash!"
            }
            var target = this, DOM =  $[ "@target" ] in target, events = $._data( target),
            types = hash.type, selector = hash.selector
            if( !events ){
                return
            }
            if( DOM ){ //处理DOM的hover事件
                types = types.replace( rhoverHack, "mouseover$1 mouseout$1" );
            }
            events = events.events || (events.events = []);
            hash.uuid = $.getUid( hash.callback ); //确保hash.uuid与callback.uuid一致
            types.replace( $.rword, function( old ){
                var item = parseType(old, selector);//"focusin.aaa.bbb"
                var type = item.type;
                var isCustom = !DOM || !$.eventSupport(type)
                $.mix(item, {
                    scode: target,//如果是自定义事件,使用window来代理
                    target: isCustom ? window : target,
                    isCustom: isCustom,
                    index: events.length
                }, hash, false);
                events.push( item );//用于事件拷贝
                events["@"+type] = ( events["@"+type] | 0 )+ 1;
                item.proxy = wrapper( item );
                item.target.addEventListener(type, item.proxy, !!selector )
            });
        },
        //外部的API已经确保typesr至少为空字符串
        unbind: function( hash, mappedTypes  ) {
            var target = this, events = $._data( target, "events");
            if(!events ) return;
            var types = hash.type || "", expr = hash.selector,
            DOM =  $["@target"] in target;
            if( DOM ){ //处理DOM的hover事件
                types = types.replace( rhoverHack, "mouseover$1 mouseout$1" );
            }
            types.replace( $.rword, function( old ){
                findHandlers( parseType(old, expr), expr, hash.callback, events).forEach( function(item){
                    $.log(item)
                    var type = item.type;
                    item.target.removeEventListener( type, item.proxy, !!expr);
                    events[item.index] = null;
                    if( --events["@"+type] == 0){
                        delete events[ "@"+type ];
                    }
                })
            });
            for (var i = events.length; i >=0;i--) {
                if (events[i] == null){
                    events.splice(i, 1);
                }
            }
            if( !events.length ){
                $.removeData( target, "events") ;
            }
            return this;
        }
    });

    "on_bind,off_unbind".replace( rmapper, function(_,method, mapper){
        $.fn[ method ] = function(types, selector, fn ){//$.fn.on $.fn.off
            if ( typeof types === "object" ) {
                for ( var type in types ) {
                    $.fn[ method ].call(this, type, selector, types[ type ], fn );
                }
                return this;
            }
            var hash = {};
            for(var i = 0 ; i < arguments.length; i++ ){
                var el = arguments[i];
                if(typeof el == "number"){
                    hash.times = el;
                }else if(typeof el == "function"){
                    hash.callback = el
                }if(typeof el === "string"){
                    if(hash.type != null){
                        hash.selector = el.trim()
                    }else{
                        hash.type = el.trim()
                    }
                }
            }
            if(method === "on"){
                if( !hash.type || !hash.callback ){//必须指定事件类型与回调
                    return this;
                }
                hash.times = hash.times > 0  ? hash.times : Infinity;
                hash.selector =  hash.selector ? quickParse( hash.selector ) : false
            }
            if(this.mass && this.each){
                return this.each(function() {
                    facade[ mapper ].call( this, hash );
                });
            }else{
                return facade[ mapper ].call( this, hash );
            }
        }
        $.fn[ mapper ] = function(){// $.fn.bind $.fn.unbind
            return $.fn[ method ].apply(this, arguments );
        }
    });

});