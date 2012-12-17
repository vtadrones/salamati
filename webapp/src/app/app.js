/**
 * Add all your dependencies here.
 *
 * @require widgets/Viewer.js
 * @require plugins/LayerTree.js
 * @require plugins/OLSource.js
 * @require plugins/OSMSource.js
 * @require plugins/WMSCSource.js
 * @require plugins/ZoomToExtent.js
 * @require plugins/NavigationHistory.js
 * @require plugins/Zoom.js
 * @require plugins/AddLayers.js
 * @require plugins/RemoveLayer.js
 * @require plugins/DistanceBearing.js
 * @require RowExpander.js
 * @require widgets/NewSourceDialog.js
 * @require overrides/override-ext-ajax.js
 * @require plugins/FeatureManager.js
 * @require plugins/FeatureEditor.js
 * @require plugins/Navigation.js
 * @require plugins/SnappingAgent.js
 * @require OpenLayers/Format/WKT.js
 * @require OpenLayers/Control/MousePosition.js
 * @require OpenLayers/Control/ScaleLine.js
 * @require plugins/Settings.js
 *
 * @requires salamatiLocale/en.js
 * @requires salamatiLocale/es.js
 */

var salamati = {
	Map: "Default Map",
	Title_Tools: "Default Tools",
	ActionTip_Default: "Distance/Bearing of features from click location",
	ActionTip_Edit: "Get feature info"
}

var app;
var addressOfWPS = "http://geoserver.rogue.lmnsolutions.com/";

var WGS84 = new OpenLayers.Projection("EPSG:4326");
var GoogleMercator = new OpenLayers.Projection("EPGS:900913");

var nameIndex;
var snappingAgent;

var toolWindowSavedPosition = null;

var toolContainer = new Ext.Container({
    xtype: "container",
    id: "mapcont",
    hidden: true,
    cls: "toolContainer"
});

var win = null;

Ext.onReady(function() {
	
    // load language setting from cookie if available
	var lang = "en";
	if (document.cookie.length > 0) {
		var cookieStart = document.cookie.indexOf("language=");
		
		if (cookieStart != -1) {
			cookieStart += "language".length + 1;
			cookieEnd = document.cookie.indexOf(";", cookieStart);
			
			if (cookieEnd == -1) {
				cookieEnd = document.cookie.length;
			}

			var lang2 = document.cookie.substring(cookieStart, cookieEnd);
			
			if (lang2) {
				lang = lang2;
			}
			console.log("---- App.onReady language setting found: ", lang);
		}
	}
	GeoExt.Lang.set(lang);


	win = new Ext.Window({
    	title: salamati.Title_Tools,
    	id: "toolsWindow",
    	closeAction: "hide",
    	xtype: "window",
    	resizable: false,
    	layout: "fit",
    	items: [
        	{
            	xtype: "panel",
            	id: "toolsPanel",
            	cls: "mytoolwindowclass",
            	layout: "hbox",
            	layoutConfig: {
                	align: 'center',
                	padding: '5'
            	}
        	}
    	],
		listeners : {
			"beforehide" : function(element) {
				toolContainer.show();
			},
			"hide" : function(element) {
				document.cookie = "toolsWindowShow=false";
			},
			"show" : function(element) {
				document.cookie = "toolsWindowShow=true";
			},
			"move" : function(element) {
				document.cookie = "toolsWindowXY=" + element.x + "|" + element.y;
			}
		}
	});	

    app = new gxp.Viewer({
    	//proxy: "/geoserver/rest/proxy?url=",
    	defaultSourceType: "gxp_wmscsource",
        portalConfig: {
            layout: "border",
            
            // by configuring items here, we don't need to configure portalItems
            // and save a wrapping container
            items: [{
                id: "centerpanel",
                xtype: "panel",
                layout: "fit",
                region: "center",
                border: false,
                items: ["mymap",
                    win, toolContainer]
            }, {
                id: "eastpanel",
                tooltip: 'Layers', //doesn't seem to work
                collapsible: true,
                layout: "fit",
                region: "east",
                width: 200
            }],
            bbar: {id: "mybbar"}
        },
        
        // configuration of all tool plugins for this application
        tools: [{
            ptype: "gxp_layertree",
            outputConfig: {
                id: "tree",
                border: true,
                tbar: [] // we will add buttons to "tree.bbar" later
            },
            outputTarget: "eastpanel"
        },{
            ptype: "gxp_addlayers",
            actionTarget: "tree.tbar"
        }, {
            ptype: "gxp_removelayer",
            actionTarget: ["tree.tbar", "tree.contextMenu"]
        }, {
            ptype: "gxp_Settings",
            actionTarget: "tree.tbar"
        }, {
            ptype: "gxp_zoomtoextent",
            actionTarget: "mymap.tbar"
        }, {
            ptype: "gxp_zoom",
            actionTarget: "mymap.tbar"
        }, {
            ptype: "gxp_navigationhistory",
            actionTarget: "mymap.tbar"
        }, {
            ptype: "gxp_featuremanager",
            id: "feature_manager",
            paging: false,
            autoSetLayer: true
        },{
            ptype: "gxp_snappingagent",
            id: "snapping_agent",
            targets: []
        },{
            ptype: "gxp_featureeditor",
            featureManager: "feature_manager",
            id: "feature_editor",
            autoLoadFeature: true,
            snappingAgent: "snapping_agent",
            iconClsEdit: "gxp-icon-getfeatureinfo",
            editFeatureActionTip: salamati.ActionTip_Edit,
            actionTarget: "toolsPanel"
        },{
            ptype: "gxp_distancebearing",
            actionTarget: "toolsPanel",
            toggleGroup: "distanceBearing",
            wpsType: "generic",
            infoActionTip: salamati.ActionTip_Default,
           // iconCls: "gxp-icon-distance-bearing-generic"
            iconCls: "gxp-icon-getfeatureinfo"
        }, {
            ptype: "gxp_distancebearing",
            actionTarget: "toolsPanel",
            toggleGroup: "distanceBearing",
            wpsType: "medfordhospitals",
            infoActionTip: salamati.ActionTip_Default,
           // iconCls: "gxp-icon-distance-bearing-hospitals"
            iconCls: "gxp-icon-getfeatureinfo"
        }, {
            ptype: "gxp_distancebearing",
            actionTarget: "toolsPanel",
            toggleGroup: "distanceBearing",
            wpsType: "medfordschools",
            infoActionTip: salamati.ActionTip_Default,
            //iconCls: "gxp-icon-distance-bearing-schools"
            iconCls: "gxp-icon-getfeatureinfo"
        }],
        
        // layer sources
        sources: {
            local: {
                ptype: "gxp_wmscsource",
                url: "/geoserver/wms",
                version: "1.1.1"
            },
            osm: {
                ptype: "gxp_osmsource"
            }
        },
        
        // map and layers
        map: {
            id: "mymap", // id needed to reference map in portalConfig above
            title: salamati.Map,
            projection: "EPSG:900913",
            center: [-10764594.758211, 4523072.3184791],
            cls: "mymapclass",
            zoom: 3,
            maxExtent: [-20037508, -20037508, 20037508, 20037508],
            restrictedExtent: [-20037508, -20037508, 20037508, 20037508],
            numZoomLevels: 20,
            layers: [{
                source: "osm",
                name: "mapnik",
                group: "background"
            }],
            items: [{
                xtype: "gx_zoomslider",
                vertical: true,
                height: 100
            }],
            tbar: [{
                xtype: 'tbfill'
            }]
        },
        
        listeners: {       	
        	
            "ready": function(){
                //Show the tools window
                
                win.animateTarget = toolContainer;
                
                Ext.get("mapcont").addListener('click', function(evtObj, element){
                    win.show();
                    toolContainer.hide();
                });
                
                var toolconthtml = document.getElementById("mapcont");
                toolconthtml.innerHTML = '<p class="css-vertical-text">' + salamati.Title_Tools + '</p>';
                
            	
                // load toolsWindowShow from cookie if available
                var toolsWindowShow = "true";
            	if (document.cookie.length > 0) {		
            		var cookieStart = document.cookie.indexOf("toolsWindowShow=");
            		
            		if (cookieStart != -1) {
            			cookieStart += "toolsWindowShow".length + 1;
            			cookieEnd = document.cookie.indexOf(";", cookieStart);
            			
            			if (cookieEnd == -1) {
            				cookieEnd = document.cookie.length;
            			}
            			var toolsWindowShow2 = document.cookie.substring(cookieStart, cookieEnd);
            			
            			if (toolsWindowShow2) {
            				toolsWindowShow = toolsWindowShow2;
            			}
            			console.log("---- App.onReady toolsWindowShow found: ", toolsWindowShow);
            		}
            	}
    			
    			if (toolsWindowShow === "false") {
    				win.hide();
    				toolContainer.show();
    			} else {
    				win.show();
    			}            	
            	
    			// load toolsWindowXY from cookie if available
    			var toolsWindowX = 60;
    			var toolsWindowY = 60;
            	if (document.cookie.length > 0) {		
            		var cookieStart = document.cookie.indexOf("toolsWindowXY=");
            		
            		if (cookieStart != -1) {
            			cookieStart += "toolsWindowXY".length + 1;
            			cookieEnd = document.cookie.indexOf(";", cookieStart);
            			
            			if (cookieEnd == -1) {
            				cookieEnd = document.cookie.length;
            			}
            			var toolsWindowXY = document.cookie.substring(cookieStart, cookieEnd);
            			
            			if (typeof toolsWindowXY != 'undefined' && toolsWindowXY) {
    						values = toolsWindowXY.split("|");
    						var x = parseFloat(values[0]);
    						var y = parseFloat(values[1]);
    						
    						if (x && y) {
    							toolsWindowX = x;
    							toolsWindowY = y;
    						}
            			}
            			console.log("---- App.onReady toolsWindowXY found: ", toolsWindowX, toolsWindowY);
            		}
            	}   
            	
				win.setPosition(toolsWindowX, toolsWindowY);
            	
                
                var map = app.mapPanel.map;
                
                map.displayProjection = "EPSG:4326";
                map.addControl(new OpenLayers.Control.ScaleLine());
                map.addControl(new OpenLayers.Control.MousePosition({
                    displayClass: 'mymouseposition'
                }));
                

                // look for cookie
				if (document.cookie.length > 0) {
					cookieStart = document.cookie.indexOf("mapCenter=");
					
					if (cookieStart != -1) {
						cookieStart += "mapCenter".length + 1;
						cookieEnd = document.cookie.indexOf(";", cookieStart);
						
						if (cookieEnd == -1) {
							cookieEnd = document.cookie.length;
						}
						
						cookietext = document.cookie.substring(cookieStart, cookieEnd);

						values = cookietext.split("|");
						lat = parseFloat(values[0]);
						lon = parseFloat(values[1]);
						zoom = parseInt(values[2]);
						
						console.log("---- App.onReady mapCenter found lat: ", lat, ", lon: ", lon, ", zoom: ", zoom);
						
						if (lat && lon && zoom) {
							map.setCenter(new OpenLayers.LonLat(lon, lat), zoom);
						}
					}
				}                
                
				
				var setMapCenterCookie = function(expiredays) {
                    
					mapCenter = new OpenLayers.LonLat(map.getCenter().lon, map.getCenter().lat);
					var cookietext = "mapCenter=" + mapCenter.lat + "|" + mapCenter.lon + "|" + map.getZoom();
					
					if (typeof expiredays != 'undefined' && expiredays) {
						var exdate = new Date();
						exdate.setDate( exdate.getDate() + expiredays);
						cookietext += ";expires=" + exdate.toGMTString();
					}
					
					// write cookie
					document.cookie = cookietext;
				}
  

				//TODO: implement but we also need to cach the sources as by defaut it only tries to parse out local host geoserver
				var setMapLayersCookie = function(expiredays) {
				}
				
				// This is what the UI does to add the layer 
//		        function addLayers() {
//	            	var key = sourceComboBox.getValue(); //local
//	            	var source = this.target.layerSources[key]; //
//	            	var records = capGridPanel.getSelectionModel().getSelections();
//	            	this.addLayers(records, source);
//	        	}
				
				

				// TODO: is this the best place to insert this?
				map.events.on({
					"moveend" : function(e) {
						setMapCenterCookie();
					},
					"zoomend" : function(e) {
						setMapCenterCookie();
					},
					"addlayer" : function(e) {
						setMapLayersCookie();
						console.log("map.events.addlayer: ", e);
					},
					"removelayer" : function(e) {
						setMapLayersCookie();
						console.log("map.events.removelayer: ", e);
					},
					"changelayer" : function(e) {
						setMapLayersCookie();
						console.log("map.events.changelayer: ", e);
					},
					scope : map
				}); 

                
                /** 
                 * Hack to make snapping more dynamic
                 * Whenever a layer is added to the map, it gets added to the snapping targets
                 */
                nameIndex = [];
                snappingAgent = app.tools.snapping_agent;
                
                map.events.register("addlayer", null, function(layer){  	
                    var layerParams = layer.layer.params;
                    
                    if(layerParams && (nameIndex.indexOf(layerParams.LAYERS) == -1))
                    {
                        var target = {
                            source:  "local",
                            name: layerParams.LAYERS
                        };
                        
                        var index = snappingAgent.targets.push(target);
                        snappingAgent.addSnappingTarget(target);
                        nameIndex.push(target.name);
                        app.selectLayer(app.getLayerRecordFromMap(target));
                    }
                });
            }
        }
    });
    	
	
});
