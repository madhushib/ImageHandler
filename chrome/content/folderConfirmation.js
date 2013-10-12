/*
 * Madhushib
 */
/** **************** Controller Class ******************** */
const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/fileUtils.js");


/**
 * Provides the FolderConfirmation
 *
 * @namespace ImageHandlerChrome
 * @class ImageHandlerChrome.FolderConfirmation
 * To handle events on folder confermation window
 */
ImageHandlerChrome.FolderConfirmation = {
    //set the saved folder menu list and add foledr names given to widow as arguments ti it
    onLoad: function(){
        var savedFolderMenulist = document.getElementById("savedFolderMenulist");     
        var folderNames = window.arguments[0].input.savedfolderNames;
        for (var i = 0; i < folderNames.length; i++) {
            savedFolderMenulist.insertItemAt(i, folderNames[i]);
        }    
        savedFolderMenulist.selectedIndex = 0;
    },  
    //save the directory value to savedFolderMenu list
    onAccept: function(){ 
        var savedFolderMenulist = document.getElementById("savedFolderMenulist");
        window.arguments[0].output.savedFolderName = savedFolderMenulist.value;    
        return true;
    },   
    onCancel: function(){	//nothing happens
        return true;
    }
};

