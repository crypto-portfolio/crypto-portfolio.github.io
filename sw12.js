function dbVersion() {
    return 10;
}

function dbName() {
    return "coinsdb1";
}

function objectStoreName() {
    return "dt1";
}

function retrieveStock(c, coins, url, price, prices, id) {

    fetch(url).then(function(response) {
        try {

            response.json().then(

                function(data) {
                    var a = data;
                    var parsedPrice = 0;
                    var parsedPrices = [];

                    for (let [key, value] of Object.entries(coins)) {

                        parsedPrice = parsedPrice + Number(value) / Number(a[key]);
                        parsedPrices[key] = Number(value) / Number(a[key]);

                    }

                    parsedPrices['total'] = parsedPrice;

                    c(parsedPrice, coins, url, price, parsedPrices, prices, id);
                }

            );

        } catch (err) {}
    });

}

function tryCreateDb() {

    var d = self.indexedDB.open(dbName(), dbVersion(), function() {
        event.target.result.createObjectStore(objectStoreName(), {
            keyPath: 'id'
        });

    });

    d.onupgradeneeded = event => {

        event.target.result.createObjectStore(objectStoreName(), {
            keyPath: 'id'
        });

    };

    d.onerror = function(event) {
        console.log('[onerror]', event);
    };

}


tryCreateDb();

self.addEventListener('activate', event => {

    tryCreateDb();



});

self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());

});


function updateDb(portfolio, url, coins, price, prices, id) {


    if(!portfolio){
        portfolio = '';
    }

    if (!coins || !Object.keys(coins).length) {
        return;
    }

    var request = self.indexedDB.open(dbName(), dbVersion());

    request.onsuccess = function(evt) {

        var db = evt.target.result;
        var transaction = db.transaction(objectStoreName(), 'readwrite');

        transaction.onsuccess = function(event) {

        };

        var store = transaction.objectStore(objectStoreName());

        if (url) {
            console.log('storing coins with price: ' + price);
            console.log(coins);
            console.log('');

            var db_op_req = store.put({
                id: id,
                url: url,
                coins: coins,
                price: price,
                prices: prices
            });
        }

    };

}

self.addEventListener('message', function(event) {


    var request = self.indexedDB.open(dbName(), dbVersion());
    var url = event.data.url;
    var coins = event.data.coins;
    var portfolio = event.data.portfolio;

    request.onerror = function(evt) {
        console.log(evt);
    }

    request.onsuccess = function(evt) {

        var db = evt.target.result;
        var transaction = null;


        try {

            transaction = db.transaction(objectStoreName(), 'readwrite');

        } catch (err) {
            tryCreateDb();
            return;
        }

        var store = transaction.objectStore(objectStoreName());




        store.getAll().onsuccess = function(event) {

            var cns = null;

            if(event.target.result && event.target.result[0]){
                cns = event.target.result[0];
            }

            function sendOldValueToBrowser(c, cns, u, oldValue, prices, oldprices, id) {

                if (self.clients) {
                    self.clients.matchAll().then(function(clients) {
                        clients.forEach(function(client) {


                            client.postMessage({
                                "oldprice": oldValue,
                                "coins": cns,
                                "url": u,
                                "oldprices": oldprices
                            });


                            console.log('send old value (' + oldValue + ')  to browser: ');
                            console.log(cns);
                            console.log('');

                            if (coins) {
                                updateDb(portfolio, url, coins, c, prices, id);
                            } else {
                                updateDb(null, u, cns, c, prices, id);
                            }




                        })
                    });
                }

            };

            if (!event.target.result) {
                updateDb(portfolio, url, coins, 0, null, null);
            }

            if (cns!= null) {
                retrieveStock(sendOldValueToBrowser, cns.coins, cns.url, cns.price, cns.prices, cns.id);
            } else {
                retrieveStock(sendOldValueToBrowser, coins, url, null, null, null);
            }


        };

    };




});

self.addEventListener("fetch", function(event) {

});

self.addEventListener('periodicsync', (pevent) => {

    var request = self.indexedDB.open(dbName(), dbVersion());

    request.onsuccess = function(evt) {

        var db = evt.target.result;
        var transaction = db.transaction(objectStoreName(), 'readwrite');

        var store = transaction.objectStore(objectStoreName());

        store.get(0).onsuccess = function(event) {

            function showNotification(c) {

                c = c.toPrecision(6);

                var options = {
                    body: 'Latest value of portfolio is ' + c,
                    icon: 'images/og-img.png',
                    vibrate: [100, 50, 100],
                    data: {
                        dateOfArrival: Date.now(),
                        primaryKey: 1
                    },
                    actions: [{
                        action: 'explore',
                        title: 'Show current price changes',
                        icon: 'images/og-img.png'
                    }]
                };

                pevent.target.registration.showNotification('Crypto notification!', options);

            };

            if (event.target.result != null) {
                retrieveStock(showNotification, event.target.result.coins, event.target.result.url, event.target.result.price, event.target.result.prices);
            } else {
                retrieveStock(showNotification, null, null, null, null);
            }

        };

    };

});
