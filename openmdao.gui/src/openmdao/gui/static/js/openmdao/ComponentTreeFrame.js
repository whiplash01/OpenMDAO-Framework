
var openmdao = (typeof openmdao === "undefined" || !openmdao ) ? {} : openmdao ;

openmdao.ComponentTreeFrame = function(id,model,select_fn,dblclick_fn,workflow_fn,dataflow_fn) {
    openmdao.ComponentTreeFrame.prototype.init.call(this,id,'Components');

    /***********************************************************************
     *  private
     ***********************************************************************/

    // initialize private variables
    var self = this,
        filter_beg = '_',
        tree = jQuery('<div>')
            .appendTo('<div style="height:100%">')
            .appendTo("#"+id);

    /** convert model.json to structure required for jstree */
    function convertJSON(json, path, openNodes) {
        var data = [];

        jQuery.each(json, function(idx,item) {
            var pathname   = item.pathname,
                type       = item.type,
                interfaces = item.interfaces,
                name = openmdao.Util.getName(pathname);

            if (filter_beg.indexOf(name[0])<0) {
                interfaces = JSON.stringify(interfaces);
                var node = { 'data': name  };
                node.attr = {
                     'type'  : type,
                     'path'  : pathname,
                     'interfaces' : interfaces
                };
                if (item.children) {
                    node.children = convertJSON(item.children, pathname,
                                                openNodes);
                }
                if (openNodes.indexOf(pathname) >= 0) {
                    node.state = 'open';
                }
                data.push(node);
            }
        });

        return data;
    }

    /** update the tree with JSON model data */
    function updateTree(json) {
        // Grab paths of currently open nodes.
        var openNodes = [];
        self.elm.find("li.jstree-open").each(function () {
            openNodes.push(this.getAttribute("path"));
        });

        tree.empty();
        tree.jstree({
            plugins     : [ "json_data", "sort", "themes", "types", "cookies", "contextmenu", "ui", "crrm" ],
            json_data   : { "data": convertJSON(json, '', openNodes) },
            themes      : { "theme":  "openmdao" },
            cookies     : { "prefix": "objtree", opts : { path : '/' } },
            contextmenu : { "items":  contextMenu },
            crrm        : { "move" : {
                                // don't allow moving within the tree (for now anyway)
                                "check_move" : function (m) {
                                    return false;
                                }
                            }
                          }
        })
        .bind("select_node.jstree", function(e,data) {
            if (typeof select_fn === 'function') {
                var path = data.rslt.obj.attr("path");
                select_fn(path);
            }
        })
        .bind("dblclick.jstree", function (e,data) {
            if (typeof dblclick_fn === 'function') {
                var node = jQuery(e.target).closest("li"),
                    path = node.attr("path");
                dblclick_fn(path);
            }
        })
        .bind("loaded.jstree", function (e, data) {
            jQuery('#'+id+' a').draggable({ 
                //helper: 'clone', 
                appendTo: 'body',
                helper: function(event) {
                    return jQuery('<span style="white-space:nowrap;background-color:black;color:white;"/>')
                        .text(jQuery(this).text());
                }
            }).addClass("component"); // so that the WorkflowFigure droppable knows what to accept

            /* add classes so that the items in the component tree are specific
               to what they are: assembly, driver or component */
            jQuery('#'+id+' li').each(function () {
                if (this.getAttribute("interfaces").indexOf("IAssembly") >= 0) {
                    this.children[1].children[0].addClass("jstree-assembly");
                }
                else if (this.getAttribute("interfaces").indexOf("IDriver") >= 0) {
                    this.children[1].children[0].addClass("jstree-driver");
                }
                else if (this.getAttribute("interfaces").indexOf("IComponent") >= 0) {
                    this.children[1].children[0].addClass("jstree-component");
                }
            });
        });
    }

    /** get a context menu for the specified node */
    function contextMenu(node) {
        var path = node.attr('path'),
            type = node.attr('type'),
            interfaces = jQuery.parseJSON(node.attr('interfaces')),
            menu = {};

        menu.properties = {
            "label"  : 'Properties',
            "action" :  function(node) {
                            var id = (path+'-properties').replace(/\./g,'-');
                            new openmdao.PropertiesFrame(id,model).editObject(path);
                        }
        };
        if (jQuery.inArray('IAssembly',interfaces) >= 0) {
            menu.show_dataflow = {
                "label"  : 'Show Dataflow',
                "action" :  function(node) {
                                dataflow_fn(path);
                            }
            };
            // shortcut to driver workflow
            menu.show_workflow = {
                "label"  : 'Show Workflow',
                "action" :  function(node) {
                                workflow_fn(path+'.driver');
                            }
            };
        }
        if (jQuery.inArray('IDriver',interfaces) >= 0) {
            menu.show_workflow = {
                "label"  : 'Show Workflow',
                "action" :  function(node) {
                                workflow_fn(path);
                            }
            };
        }
        menu.run = {
            "label"  : 'Run this Component',
            "action" :  function(node) {
                            model.runComponent(path);
                        }
        };
        menu.toggle = {
            "label"  : 'Toggle Hidden Components',
            "action" :  function(node) {
                            if (filter_beg.length === 0) {
                                filter_beg = '_';
                            }
                            else {
                                filter_beg = '';
                            }
                            self.update();
                        }
        };
        menu.remove = {
            "label"  : 'Remove',
            "action" :  function(node) {
                            model.removeComponent(path);
                        }
        };
        return menu;
    }

    function handleMessage(message) {
        if (message.length !== 2 || message[0] !== 'components') {
            debug.warn('Invalid components data:',message);
        }
        else {
            components = jQuery.parseJSON(message[1]);
            updateTree(components);
        }
    }

    // listen for 'components' messages and update object tree accordingly
    model.addListener('components', handleMessage);

    /***********************************************************************
     *  privileged
     ***********************************************************************/

    this.destructor = function() {
        model.removeListener('components', handleMessage);
    };

    /** update the tree, with data from the model  */
    this.update = function() {
        model.getComponents(updateTree);
    };

    // load initial component data
    model.model_ready.always(function() {
       self.update();
    });
};

/** set prototype */
openmdao.ComponentTreeFrame.prototype = new openmdao.BaseFrame();
openmdao.ComponentTreeFrame.prototype.constructor = openmdao.ComponentTreeFrame;

