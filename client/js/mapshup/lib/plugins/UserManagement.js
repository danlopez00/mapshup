/*
 * mapshup - Webmapping made easy
 * http://mapshup.info
 *
 * Copyright Jérôme Gasperi, 2011.12.08
 *
 * jerome[dot]gasperi[at]gmail[dot]com
 *
 * This software is a computer program whose purpose is a webmapping application
 * to display and manipulate geographical data.
 *
 * This software is governed by the CeCILL-B license under French law and
 * abiding by the rules of distribution of free software.  You can  use,
 * modify and/ or redistribute the software under the terms of the CeCILL-B
 * license as circulated by CEA, CNRS and INRIA at the following URL
 * "http://www.cecill.info".
 *
 * As a counterpart to the access to the source code and  rights to copy,
 * modify and redistribute granted by the license, users are provided only
 * with a limited warranty  and the software's author,  the holder of the
 * economic rights,  and the successive licensors  have only  limited
 * liability.
 *
 * In this respect, the user's attention is drawn to the risks associated
 * with loading,  using,  modifying and/or developing or reproducing the
 * software by the user in light of its specific status of free software,
 * that may mean  that it is complicated to manipulate,  and  that  also
 * therefore means  that it is reserved for developers  and  experienced
 * professionals having in-depth computer knowledge. Users are therefore
 * encouraged to load and test the software's suitability as regards their
 * requirements in conditions enabling the security of their systems and/or
 * data to be ensured and,  more generally, to use and operate it in the
 * same conditions as regards security.
 *
 * The fact that you are presently reading this means that you have had
 * knowledge of the CeCILL-B license and that you accept its terms.
 */
/*
 *
 * UserManagement plugin
 * 
 * This plugin add authentication capabilities to maspshup
 * The authentication mechanism is based on OpenID protocol
 *
 */
(function(msp) {
    
    msp.Plugins.UserManagement = function() {
        
        /*
         * Only one UserManagement object instance is created
         */
        if (msp.Plugins.UserManagement._o) {
            return msp.Plugins.UserManagement._o;
        }
        
        /**
         * If set then user is connectec, otherwise not
         * 
         * Structure of userInfo is :
         * 
         *  {
         *      'userid': // Unique user id
         *      'username': // User name
         *      'email': // Unique user email
         *      'icon': // Url to the user icon gravatar
         *      'password': // User password encryptes in MD5
         *  };
         * 
         */
        this.userInfo = null;

        /**
         * Userbar items array
         * 
         * Item structure :
         * {
         *      id: // identifier
         *      icon: // icon url,
         *      title: // Displayed title on mouse over
         *      callback: // function to execute on click
         * }
         */
        this.items = [
            {
                id:msp.Util.getId(),
                icon:msp.Util.getImgUrl("disconnect.png"),
                title:"Disconnect",
                callback:function(scope) {
                    if (scope.userInfo) {
                        msp.Util.askFor(msp.Util._("Sign out"), msp.Util._("Do you really want to sign out ?"), "list", [{
                            title:msp.Util._("Yes"), 
                            value:"y"
                        },
                        {
                            title:msp.Util._("No"), 
                            value:"n"
                        }
                        ], function(v){
                            if (v === "y") {
                                scope.disconnect();
                            }
                        });
                    }
                }
            },
            {
                id:msp.Util.getId(),
                icon:msp.Util.getImgUrl("save.png"),
                title:"Save context",
                callback:function(scope) {
                    scope.storeContext();
                }
            }
        ];
        
        /**
         * Initialize plugin
         *
         * This is MANDATORY
         */
        this.init = function(options) {

            var userInfo, self = this;
            
            /**
             * Best practice : init options
             */
            self.options = options || {};

            $.extend(self.options,{
                loginUrl:self.options.loginUrl || "/plugins/usermanagement/login.php",
                registerUrl:self.options.registerUrl || "/plugins/usermanagement/register.php",
                saveContextUrl:self.options.saveContextUrl || "/plugins/usermanagement/saveContext.php"
            });
            
            /*
             * The Sign In / Sign Up buttons and the user toolbar are stored within
             * the header bar under the 'userBar' CSS class
             */
            self.$d = $('.userBar', msp.$header);
            
            /**
             * Check for a connection cookie
             */
            userInfo = JSON.parse(msp.Util.Cookie.get("userInfo"));
        
            if (userInfo) {
                self.signIn(userInfo.email, userInfo.password, true);
            }
            else {
                self.displaySignInButton();
            }
            
            return this;
        };
        
        /*
         * Add action items to the userBar
         * 
         * This function should be called by plugins
         * that require additionnal item userBar
         * 
         * @input items : array of menu items
         * 
         * Item structure :
         * {
         *      id: // identifier
         *      icon: // icon url,
         *      title: // Displayed title on mouse over
         *      callback: // function to execute on click
         * }
         */
        this.addToUserBar = function(items) {
            
            if ($.isArray(items)) {
                
                /*
                 * Add new item
                 */
                for (var i = 0, l = items.length;i<l;i++) {
                    this.items.push(items[i]);
                }

                /*
                 * Recompute items position within the menu
                 */
                this.displayUserBar();
            }
            
            return true;
            
        };
        

        /*
         * Store context within cookie
         * 
         * Note that a SYNCHRONOUS ajax call is sent to the server
         * to ensure that the browser or the window does not close
         * before the context is stored within the database
         * 
         */
        this.storeContext = function() {
            
            var self = this;
            
            if (self.userInfo) {    
                msp.Util.ajax({
                    dataType:"json",
                    type:"POST",
                    url:msp.Util.getAbsoluteUrl(self.options.saveContextUrl),
                    data:msp.Util.abc+"&email=" + self.userInfo.email + "&password=" + self.userInfo.password + "&context=" + encodeURIComponent(JSON.stringify(msp.Map.getContext())),
                    success: function(data){
                        msp.Util.message(msp.Util._("Context succesfully stored"));
                    },
                    error: function(msg) {
                        msp.Util.message(msp.Util._("Error : context cannot be stored"));
                    }
                },{
                    title:msp.Util._("Store context"),
                    cancel:true
                });
                
            }
        };
        
        /**
         * Disconnect user
         */
        this.disconnect = function() {
            
            var self = this;
            
            /*
             * Store context within cookie
             */
            self.storeContext();
            
            /*
             * Remove userInfo cookie
             */
            msp.Util.Cookie.remove("userInfo");
            
            /*
             * Tell UserManagement that user is disconnected
             */
            self.userInfo = null;
            
            /*
             * Display the Sign in / Sign up bar
             */
            self.displaySignInButton();
            
                        
        };

        /**
         * Register action.
         *
         * If register is successfull an email is sent to the given email adress
         */
        this.register = function(email, username) {

            /*
             * Check if email is valid
             */
            if (!msp.Util.isEmailAdress(email)) {
                msp.Util.message(msp.Util._("Please enter a valid email adress"));
                return false;
            }

            /*
             * Check if username is set
             */
            if (!username) {
                msp.Util.message(msp.Util._("Please enter a valid username"));
                return false;
            }

            /**
             * Register user
             */
            msp.Util.ajax({
                dataType:"json",
                type:"POST",
                url:msp.Util.getAbsoluteUrl(this.options.registerUrl),
                data:msp.Util.abc+"&email=" + email + "&username=" + username,
                success: function(data){
                    if (data.error) {
                        msp.Util.message(data.error["message"]);
                    }
                    else {
                        msp.Util.message(msp.Util._("A password has been sent to your mailbox"));
                    }
                },
                error: function(msg) {
                    msp.Util.message(msp.Util._("An error occured during password generation. Registering is currently disable"));
                }
            },{
                title:msp.Util._("Register"),
                cancel:true
            });

            return true;
        };

        /**
         * Sign in action
         */
        this.signIn = function(email, password, checkCookie) {

            var self = this,
            
            /*
             * If checkCookie is true, the password is already encrypted
             */
            encrypted = checkCookie ? "&encrypted=true" : "";

            /*
             * Send an ajax login request
             */
            msp.Util.ajax({
                dataType:"json",
                type:"POST",
                url:msp.Util.getAbsoluteUrl(self.options.loginUrl),
                data:msp.Util.abc+"&email=" + email + "&password=" + password + encrypted,
                success: function(data){
                    
                    if (data.username) {

                        /*
                         * Set userInfo
                         */
                        self.userInfo = {
                            'userid':data.userid,
                            'username':data.username,
                            'email':data.email,
                            'icon':data.icon,
                            'password':data.password
                        };
                            
                        /*
                         * Load the user last context
                         */
                        if (data.context) {
                            msp.Util.askFor(msp.Util._("Hello") + " " + data.username, msp.Util._("Do you want to restore your map context ?"), "list", [{
                                title:msp.Util._("Yes"), 
                                value:"y"
                            },
                            {
                                title:msp.Util._("No"), 
                                value:"n"
                            }
                            ], function(v){
                                if (v === "y") {
                                    if (msp.Util.Cookie.get("context")) {
                                        msp.Map.loadContext(data.context);
                                    }
                                }
                            });
                        }
                        
                        /*
                         * If checkCookie or rememberMe is true, respawn
                         * a cookie for one year
                         */
                        if (checkCookie || $('#rememberMe').is(':checked')) {
                            msp.Util.Cookie.set("userInfo", JSON.stringify(self.userInfo), 365);
                        }

                        /*
                         * Create a cookie for the remaining of the session
                         * (valid until you close the navigator)
                         */
                        else {
                            msp.Util.Cookie.set("userInfo", JSON.stringify(self.userInfo));
                        }

                        /*
                         * Remove login popup
                         */
                        if (self._p) {
                            self._p.remove();
                        }
                        
                        /*
                         * Display user bar
                         */
                        self.displayUserBar();
                        
                    }
                    else {

                        if (!checkCookie) {
                            msp.Util.message(msp.Util._("Wrong login/password - Connection refused"));
                        }
                        else {
                            self.disconnect();
                        }
                        
                        /*
                         * Display Sign in / Sign up button
                         */
                        self.displaySignInButton();
                        
                    }
                },
                error: function(msg) {
                    if (!checkCookie) {
                        msp.Util.message(msp.Util._("Wrong login/password - Connection refused"));
                    }
                    else {
                        self.disconnect();
                    }
                    
                    /*
                     * Display Sign in / Sign up button
                     */
                    self.displaySignInButton();
                        
                }
            }, !checkCookie ? {
                title:msp.Util._("Login")
            } : null);
        };

        /*
         * Display user toolbar
         */
        this.displayUserBar = function() {
            
            var i, self = this;
            
            if (!self.userInfo) {
                return false;
            }
            
            /*
             * Create Toolbar
             */
            self.$d.empty();
            self.tb = new msp.Toolbar({
                parent:self.$d, 
                classes:'umgmt'
            });
            
            /*
             * Profile
             */
            self.tb.add({
                id:msp.Util.getId(),
                icon:self.userInfo.icon,
                tt:"Open profile",
                activable:false,
                switchable:false,
                callback:function() {
                    alert("TODO : profile manager for " + self.userInfo.username);
                }
            });
            
            /*
             * Items are displayed from right to left regarding the store order
             * (i.e. first item is displayed on the right, then next item is displayed
             *  at the left of the previous one, and so on)
             */
            for (i = self.items.length; i--;) {
                (function(item, scope) {
                                
                    if ($.isFunction(item.callback)) {
                        
                        scope.tb.add({
                            id:item.id,
                            icon:item.icon,
                            tt:item.title,
                            activable:false,
                            switchable:false,
                            callback:function() {
                                item.callback(scope);
                            }
                        });
                        
                    }

                })(self.items[i], self);
            }
            
            return true;
            
        };
        
        /*
         * Display user toolbar
         */
        this.displaySignInButton = function() {
            
            var self = this,
            sinid = msp.Util.getId(),
            supid = msp.Util.getId();
            
            /*
             * Add Sign in and Sign up button
             */
            self.$d.html('<a href="#" class="button inline signin" id="'+sinid+'">'+msp.Util._("Sign in")+'</a> &nbsp; <a href="#" class="button inline signup" id="'+supid+'">'+msp.Util._("Sign up")+'</a></div>');
            
            /*
             * Sign In popup
             */
            $('#'+sinid).click(function(){
                
                var id = msp.Util.getId();
                
                if (self._p) {
                    self._p.remove();
                }
                
                /*
                 * Create the Sign In popup
                 */
                self._p = new msp.Popup({
                    modal:true,
                    noHeader:true,
                    onClose:function(){
                        self._p = null;
                    },
                    header:'<p>' + msp.Util._["Sign in"] + '</p>',
                    body:'<form action="#" method="post" class="loginPanel"><input id="userEmail" type="text" placeholder="'+msp.Util._("Email")+'"/><br/><input id="userPassword" type="password" placeholder="'+msp.Util._("Password")+'"/><div class="signin"><a href="#" class="button inline colored" id="'+id+'">'+msp.Util._("Sign in")+'</a> <input name="rememberme" id="rememberMe" type="checkbox" checked="checked"/>&nbsp;'+msp.Util._("Remember me")+'</div></form>'
                });
                
                /*
                 * Login button
                 */
                $('#'+id).click(function(){
                    self.signIn($('#userEmail').val(), $('#userPassword').val(), false);
                    return false;
                });

                self._p.show();
                
            });
            
            
            /*
             * Sign Up popup
             */
            $('#'+supid).click(function(){
                
                var id = msp.Util.getId();
                
                if (self._p) {
                    self._p.remove();
                }
                
                /*
                 * Create the Sign Up popup
                 */
                self._p = new msp.Popup({
                    modal:true,
                    noHeader:true,
                    onClose:function(){
                        self._p = null;
                    },
                    header:'<p>' + msp.Util._["Sign up"] + '</p>',
                    body:'<form action="#" method="post" class="loginPanel"><input id="userEmail" type="text" placeholder="'+msp.Util._("Email")+'"/><br/><input id="userName" type="text" placeholder="'+msp.Util._("Username")+'"/><div class="signin"><a href="#" class="button inline colored" id="'+id+'">'+msp.Util._("Sign up")+'</a></div></form>'
                });
                
                /** 
                 * Register button
                 */
                $('#'+id).click(function(){
                    self.register($('#userEmail').val(), $('#userName').val());
                    return false;
                });
            
                self._p.show();
            });
            
            
            return true;
            
        };
        
        /**
         * Open authentication popup window
         * TODO
         */
        this.openLoginWindow = function(openid) {
            
        /*
             * Use google by default
             */
        //openid = openid || "https://www.google.com/accounts/o8/id";
        //var w = window.open('http://localhost/mspsrv/login.php?action=verify&openid_identity='+encodeURIComponent(openid), 'openid_popup', 'width=450,height=500,location=1,status=1,resizable=yes');
            
        };
        
        /*
         * Set unique instance
         */
        msp.Plugins.UserManagement._o = this;
        
        return this;
        
    };
})(window.msp);