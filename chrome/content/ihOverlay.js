/*
 * Madhushib
 */
 
 /**********TheBrowser overlay*********************/

Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/model.js");
Components.utils.import("resource://imagehandler/settings.js");

Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

/**
 * @class ihiverlay
 * init function
 */
ImageHandlerChrome.init = function(){
	   var buttonNames = ["ipbutton-simple", "ipbutton-all","ipbuttons"];	//buttons to pick images in current tab, all tabs

	   // Add buttons to toolbar on first run
	   Application.getExtensions(function (extensions) {
            let extension = extensions.get("ImageHandler@rama.org");
            ImageHandler.Logger.info("First run: " + extension.firstRun);
            if (extension.firstRun) {
            	ImageHandler.Logger.info("Installing button on first run.");
    	    	buttonNames.forEach(function(buttonName){
	    		    var buttonId = buttonName + "-toolbar";
	    		    var isShow = ImageHandler.Settings.isShowOnToolbar(buttonName);
    		    	ImageHandlerChrome.installButton("nav-bar", buttonId, isShow);
	    		    ImageHandler.Logger.debug("Installed button: " + buttonId + " to toolbar, isShow="+isShow);
	    		});
    	    	   
	    		//read and write back the favourites file to verify it exists
    	    	var JSONimages = JSON.stringify(new Array());
    	    	var file = FileUtils.getFile("ProfD", ["FavouriteFile"]);
    	    	var ostream = FileUtils.openSafeFileOutputStream(file)

    	    	var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    	    	converter.charset = "UTF-8";
    	    	var istream = converter.convertToInputStream(JSONimages);

    	    	// The last argument (the callback) is optional.
    	    	NetUtil.asyncCopy(istream, ostream, function(status) {
    	    	  if (!Components.isSuccessCode(status)) {
    	    	    alert("Failed writing");
    	    	    return;
    	    	  }
    	    	  //alert("Suceeded writing");
    	    	});
    	    	
            }
       });

      // Add buttons to context menu
	  var contextMenu = document.getElementById("contentAreaContextMenu");
	  if (contextMenu){
	    contextMenu.addEventListener("popupshowing", function(){
    	    	buttonNames.forEach(function(buttonName){
    	    		    var button = document.getElementById(buttonName + "-context");
    	    		    var isShow = ImageHandler.Settings.isShowOnContextMenu(buttonName);
    	    		    button.hidden = !isShow;
    	    		    ImageHandler.Logger.debug("button: " + button.id + ", hidden=" + button.hidden);
    	    		});
	    }, false);
	  }
};
window.addEventListener("load", ImageHandlerChrome.init, false);	//at load of browser call imagehandler init

/**
 * Return the "browser" type object.
 */
ImageHandlerChrome.getCurrentBrowser = function(){
        return gBrowser.selectedBrowser;
};

/**
 * Return the "tab" type object. gBrowser.selectedTab == gBrowser.mCurrentTab
 * and gBrowser.selectedBrowser ==
 * gBrowser.getBrowserAtIndex(gBrowser.tabContainer.selectedIndex) and
 * gBrowser.selectedBrowser == gBrowser.getBrowserForTab(gBrowser.selectedTab)
 * and gBrowser.tabs == gBrowser..tabContainer.childNodes
 */
ImageHandlerChrome.getCurrentTab = function(){
    return gBrowser.selectedTab;
};

/**
 * set parameters in strinbundle preferences
 */
ImageHandlerChrome.getFormattedString = function(key, parameters){
    // Get a reference to the strings bundle
    var stringsBundle = document.getElementById("ip-string-bundle");
    return stringsBundle.getFormattedString(key, parameters);
};

/**
 * Callback function to pick images from current tab
 */
ImageHandlerChrome.pickImagesFromCurrentTab = function(event){
    event.stopPropagation();
    // Collect current tab
    var currentTab = ImageHandlerChrome.getCurrentTab();
    var tabs = [currentTab]

    // Get document title
    var currentTabTitle = ImageHandlerChrome.getCurrentBrowser().contentDocument.title;

    // Pick image
    ImageHandlerChrome.pickImages(tabs, currentTabTitle);
};

/**
 *Callback function for pick images from all tabs
 */
ImageHandlerChrome.pickImagesFromAllTabs = function(event){
    event.stopPropagation();	//not be called at 2nd click on button
    // Collect tabs
    var tabs = [];
    for(var i=0; i<gBrowser.tabContainer.childNodes.length; i++){
        tabs.push(gBrowser.tabContainer.childNodes[i])
    }
    // Get document title
    var currentTabTitle = ImageHandlerChrome.getCurrentBrowser().contentDocument.title;
    // Pick image
    ImageHandlerChrome.pickImages(tabs, currentTabTitle);
};

/**
 * Callback on favourite button click
 * @param {} event
 */
ImageHandlerChrome.pickImagesFromFav = function(event){
    event.stopPropagation();
    //read the favourite file
    var file = FileUtils.getFile("ProfD", ["FavouriteFile"]);
	NetUtil.asyncFetch(file, function(inputStream, status) {
		  if (!Components.isSuccessCode(status)) {
			  alert("Unexpected Error Occured!");
		  }
		  dataa = NetUtil.readInputStreamToString(inputStream, inputStream.available());	//read file
		  ImageHandlerChrome.setFavWindow(dataa);	//set window
		});	
};

/**
 * Render favourites window
 * @param {} data
 */
ImageHandlerChrome.setFavWindow = function(data){
	var imageList = new Array();
    var imageInfoList = new Array();
	imageList = JSON.parse(data);
	var currentImageList = new Array();
	
	for(var i = 0 ; i < imageList.length ; i++){	//create image elements from retrived JSON data
		var elem = new Image();
		elem.src = imageList[i].url;
		elem.height = imageList[i].height;
		elem.width = imageList[i].width;
		elem.id = imageList[i].id;
		currentImageList.push(elem);
	}
	//set image list
	imageInfoList = imageInfoList.concat(ImageHandlerChrome.convertAndTidyImage(currentImageList));
	var title = "My Favorites";
	//get tab details
	var currentTab = ImageHandlerChrome.getCurrentTab();
    var tabs = [currentTab];
	var listeners = [new ImageHandlerChrome.CloseTabListener(tabs)];
	var type = "fav";
    var params = {
    		"type":type,
            "imageList": imageInfoList,
            "title": title,
            "listeners": listeners,
            "browser": gBrowser.selectedBrowser,
            "popupNotifications": PopupNotifications
        };
        //drow favourite window
        var mainWindow = window.openDialog("chrome://imagehandler/content/pick.xul", "PickImage.mainWindow", "chrome,centerscreen,resizable, dialog=no, modal=no, dependent=no,status=yes", params);
        mainWindow.focus();
}

/**
 * Called feom methods to pick images
 * Law level pick function
 * @param {} event
 * @param {} tabTitle
 */
ImageHandlerChrome.pickImagesFromTabs = function(event, tabTitle){
    event.stopPropagation();
    // Collect all tabs contain the given tabTitle
    var tabs = [];
    for (var i = 0, numTabs = gBrowser.browsers.length; i < numTabs; i++) {
        var curBrowser = gBrowser.getBrowserAtIndex(i);
        var curTitle = curBrowser.contentDocument.title;
        if (curTitle.indexOf(tabTitle) != -1) {
            tabs.push(gBrowser.tabContainer.childNodes[i]);
        }
    }
    // Pick image
    ImageHandlerChrome.pickImages(tabs, tabTitle);
};

/**
 * Pick image from the given tabs
 *
 * @param {Array[XULTab]}
 *            tabs
 * @param {String}
 *            title
 */
ImageHandlerChrome.pickImages = function(tabs, title){
    // init cache session
    var cacheService = Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService);
    ImageHandlerChrome.httpCacheSession = cacheService.createSession("HTTP", Ci.nsICache.STORE_ANYWHERE, Ci.nsICache.STREAM_BASED);
    ImageHandlerChrome.httpCacheSession.doomEntriesIfExpired = false;

    // Get images from all given tabs
    var imageInfoList = new Array();
    tabs.forEach(function(tab){
        ImageHandler.Logger.debug("handling tab = " + tab);
        var browser = gBrowser.getBrowserForTab(tab);
        var contentWindow = browser.contentWindow;
        var documentList = ImageHandlerChrome.getDocumentList(contentWindow);
        for (var i = 0; i < documentList.length; i++) {
            // handle current document
            var currentDocument = documentList[i];
            var currentImageList = new Array();
            var documentImageList = currentDocument.getElementsByTagName('img');
            for (var j = 0; j < documentImageList.length; j++) {
                var image = documentImageList[j];
                if (image.src != null && image.src != "") {	//if image src is not empty
                    currentImageList.push(image);
                }
            }
            ImageHandler.Logger.info("document = " + currentDocument.title + ", images = " + currentImageList.length);
            imageInfoList = imageInfoList.concat(ImageHandlerChrome.convertAndTidyImage(currentImageList));
        }// end for each document
    });

    // Collect tabs to be closed after saved images
    var listeners = [new ImageHandlerChrome.CloseTabListener(tabs)];
    var type = "nfav";	//indicate the window type

    // Prepare parameters
    var params = {
    	"type":type,
        "imageList": imageInfoList,
        "title": title,
        "listeners": listeners,
        "browser": gBrowser.selectedBrowser,
        "popupNotifications": PopupNotifications
    };
   //draw window 
    var mainWindow = window.openDialog("chrome://imagehandler/content/pick.xul", "PickImage.mainWindow", "chrome,centerscreen,resizable, dialog=no, modal=no, dependent=no,status=yes", params);
    mainWindow.focus();
};

/**
 * Fetch all the documents in a frame
 * @param {} frame
 * @return {} document list
 */
ImageHandlerChrome.getDocumentList = function(frame){
   var documentList = new Array();
    documentList.push(frame.document);
    var framesList = frame.frames;
    for (var i = 0; i < framesList.length; i++) {
        if (framesList[i].document != frame.document) {
            documentList.push(framesList[i].document);
        }
    }
    return documentList;
};

/**
 * 1. Filter duplicate image 2. Convert the given HTMLElement image list to the
 * ImageHandler.ImageInfo list 3. Sort image by Top
 *
 * @param {Array[HTMLElement]}
 *            htmlImageList
 * @return {Array[ImageHandler.ImageInfo]}
 */
ImageHandlerChrome.convertAndTidyImage = function(htmlImageList){

    // Filter image by url
    var tidiedHtmlImageList = ImageHandlerChrome.filterDuplicateImage(htmlImageList);
    ImageHandler.Logger.info("imageList.length  = " + htmlImageList.length + ", tidiedHtmlImageList.length  = " +
    tidiedHtmlImageList.length);

    // Convert to ImageHandler.ImageInfo
    var imageInfoList = new Array();
    var guid = (new Date()).getTime();
    for (var j = 0; j < tidiedHtmlImageList.length; j++) {
        var tImg = tidiedHtmlImageList[j];
        ImageHandler.Logger.info("image" + j + " = " + tImg.src);
        var image = new ImageHandler.ImageInfo(guid++, tImg, ImageHandlerChrome.getImageTop(tImg));	//add image top & time, so can show on tht order
        ImageHandlerChrome.ImageUtils.updateFileExtensionByMIME(image);
        ImageHandlerChrome.ImageUtils.updateFileSizeFromCache(image);
        ImageHandlerChrome.ImageUtils.updateFileNameFromCache(image);
        imageInfoList.push(image);
    }
   // Sort by the image top
    imageInfoList.sort(ImageHandlerChrome.sortImagesByTop);
    return imageInfoList;
};

/**
 * Filter duplicate image by image URL
 * * @param {Array[HTMLElement]}
 *            imageList
 * @return {Array[HTMLElement]}
 */
ImageHandlerChrome.filterDuplicateImage = function(imageList){
    var results = new Array();
    imageList.sort(ImageHandlerChrome.sortImagesBySrc);
    for (var i = 0; i < imageList.length; i++) {
        if ((i + 1 < imageList.length) && (imageList[i].src == imageList[i + 1].src)) {
            continue;
        }
        results.push(imageList[i]);
    }
    return results;
};

/**
 * Sort image by image src
 *
 * @param {HTMLElement}
 *            imageOne
 * @param {HTMLElement}
 *            imageTwo
 */
ImageHandlerChrome.sortImagesBySrc = function(imageOne, imageTwo){
    var imageOneSrc = imageOne.src;
    var imageTwoSrc = imageTwo.src;
    var sortValue = 1;
    if (imageOneSrc == imageTwoSrc) {
        sortValue = 0;
    } else if (imageOneSrc < imageTwoSrc) {
        sortValue = -1;
    }
    return sortValue;
};

/**
 * Sort image by image top
 *
 * @param {ImageHandler.ImageInfo}
 *            imageOne
 * @param {ImageHandler.ImageInfo}
 *            imageTwo
 */
ImageHandlerChrome.sortImagesByTop = function(imageOne, imageTwo){
    var imageOneTop = imageOne.top;
    var imageTwoTop = imageTwo.top;
    var sortValue = 1;
    if (imageOneTop == imageTwoTop) {
        sortValue = 0;
    } else if (imageOneTop < imageTwoTop) {
        sortValue = -1;
    }
    return sortValue;
};

/**
 * Get the top of image element
 *indicate position of image
 * @param {HTMLElement}
 *            image
 */
ImageHandlerChrome.getImageTop = function(image){
    var top =image.getBoundingClientRect().top + document.documentElement.scrollTop;
    return top;
};

/**
 *set popup menu configuration 
 * @param {} event
 */
ImageHandlerChrome.onPopupMenuShowing = function(event){
    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.imagehandler.")
    // update menu items
    var configureMenuitem;
    var menuPopup = event.target;
    var children = menuPopup.children;
    for (var i = children.length - 1; i >= 0; i--) {
        var child = children[i];
        if (child.id == null || child.id == "") {
            menuPopup.removeChild(child); // Remove all dynamic menu items
        } else if(child.id == "ipbtn-menu-configure"){
        	configureMenuitem = child; // Locate configure menu
        } else if(child.id == "ipbtn-menu-configure-doubleclick-save"){
        	child.setAttribute("checked", prefs.getBoolPref("collector.doubleclickImageToSave.enable")); // Update check status
        } else if(child.id == "ipbtn-menu-configure-drap-save"){
            child.setAttribute("checked", prefs.getBoolPref("collector.dragImageToSave.enable")); // Update check status
        }
    }
    // Generate dynamic menu item by tab title
    var XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    // Split current tab title to collect feeds
    var currentTabTitle = ImageHandlerChrome.getCurrentBrowser().contentDocument.title;
    var separator = /-|_|\(|\)|\[|\]|\|/;
    var feedTexts = currentTabTitle.split(separator);
    var feeds = new Array();
    for (var i = 0; i < feedTexts.length; i++) {
        var feedText = feedTexts[i].trim();
        if (feedText.length > 1) { // collect only feedText is larger than 1
									// chars
            var feed = {
                text: feedText,
                occurrence: 0
            }
            ImageHandler.Logger.info("feed = [" + feed.text + ", " + feed.occurrence + "]");
            feeds.push(feed);
        }
    }

    // collect statistics from all tabs
    for (var i = 0, numTabs = gBrowser.browsers.length; i < numTabs; i++) {
        var curBrowser = gBrowser.getBrowserAtIndex(i);
        var curTitle = curBrowser.contentDocument.title;
        feeds.forEach(function(feed){
            if (curTitle.indexOf(feed.text) != -1) {
                feed.occurrence = feed.occurrence + 1;
            }
        });
    }

    // sort occurrence
    feeds.sort(function(feed1, feed2){
        return feed1.occurrence - feed2.occurrence;
    });

    // Add menu items when occurrence is larger than 1
    var hasNewMenuitem = false;
    feeds.forEach(function(feed){
        if (feed.occurrence > 1) {
            var label = ImageHandlerChrome.getFormattedString("pickButtonDynamicMenuItem", [feed.text, feed.occurrence]);
            var menuitem = document.createElementNS(XUL_NS, "menuitem");
            menuitem.setAttribute("label", label);
            menuitem.setAttribute("class", "menuitem-iconic dynamic-pick-menu-item");
            menuitem.addEventListener("command", function(e){
                ImageHandlerChrome.pickImagesFromTabs(e, feed.text);
            }, false);

            menuPopup.insertBefore(menuitem, configureMenuitem);
            hasNewMenuitem = true;
        }
    });

    if(hasNewMenuitem){
    	var separator = document.createElementNS(XUL_NS, "menuseparator");
    	menuPopup.insertBefore(separator, configureMenuitem);
    }
};

/**
 * eneble or disable a preference on request
 * @param {} event
 * @param {} prefName
 */
ImageHandlerChrome.enableOrDisablePref = function(event, prefName){
    event.stopPropagation();
    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("extensions.imagehandler.")
    var value = prefs.getBoolPref(prefName);
    prefs.setBoolPref(prefName, !value);
};



/** **************** CloseTabListener Object Class ******************** */
/**
 * Provides the CloseTabListener class to close browser tabs after saved images
 *
 * @namespace ImageHandlerChrome
 * @class ImageHandlerChrome.CloseTabListener
 * @constructor
 */
ImageHandlerChrome.CloseTabListener = function(tabs) {
    this.tabs = tabs;
};

ImageHandlerChrome.CloseTabListener.prototype = {
    afterSavedImages: function(savedFolder, images){
        ImageHandler.Logger.debug("Closing tabs...");

        if (this.tabs && ImageHandler.Settings.isCloseBrowserTabAfterSaved()) {
            // Create a blank tab if close all tabs to avoid Firefox is closed.
            if(this.tabs.length == gBrowser.tabContainer.childNodes.length){
                gBrowser.addTab("about:blank");
            }
            // Close all tabs
            this.tabs.forEach(function(tab){
                if (tab) {
                    gBrowser.removeTab(tab);
                }
            });
        }// end if tabs
    }
};
