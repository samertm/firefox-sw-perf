# Firefox SW Perf Repro

To run this test:

1. Start the server by running `npm install && node app.js`.

2. Navigate to "localhost:4445" once to warm up your cache, and then run `localStorage.removeItem("exp_data")` so that run doesn't count.

3. Then, navigate to one of the links below by typing it in your location bar

4. To run a test multiple times, do "ctrl+l" then "enter" to navigate to the page without triggering a bunch of 304's, which skew the data

5. Make sure that devtools is closed, because that skews the stats on Firefox

The following are valid paths: 

 * / (just the index, doesn't load a service worker)
 * /with_sw (loads a bare-bones service worker that doesn't respond to requests)
 * /with_dbxsw (loads the dropbox service worker, which has complex handling for whitelisted urls)
 * /with_faster_dbxsw (loads the dropbox service worker, updated so that it doesn't respond to non-navigate requests)

# Results

These are my results from running the test on Firefox 50 and Chrome
54, with a high-end Linux desktop.


## Firefox 50

There are a couple things going on with Firefox:

 * I don't think firefox has an in-memory caching mechanism, so every request pulls from disk (or maybe a very, very slow in-memory cache).
 * Even when something is cached, Firefox is firing up the service worker, when Chrome skips it completely. (The served resources have large max-ages, so they should be cache hits w/o needing to hit the network at all).
 * For /with_dbxsw, the logic to whitelist routes is a bit complex, and I think the high average duration is caused by lots of fetches needing to wait on the single-threaded service worker to return.

For cache hits where the max-age is large enough that it doesn't need
to hit the network, pinging the service worker is probably a bug.
EDIT: Apparently this is expected behavior:
https://github.com/w3c/ServiceWorker/issues/962#issuecomment-264279456


```
Key: /
Loaded 1008 resources
Average duration: 43.4240519265873
jQuery duration: 55.06311109523809

Key: /with_sw
Loaded 1008 resources
Average duration: 58.124283287698404
jQuery duration: 67.2021141904762

Key: /with_dbxsw
Loaded 1008 resources
Average duration: 226.84643538492062
jQuery duration: 437.8668471428571

Key: /with_faster_dbxsw
Loaded 1008 resources
Average duration: 68.87328381349207
jQuery duration: 80.17416114285714
```


## Chrome 54

Chrome behaves a bit differently: the first request for cached item
will take longer, and then it will be as if every item is "warm" in
memory, the avg duration is 0. Removing/changing the service worker
seems to evict the "warm", in-memory cache. Need to dig into this a
bit more.

```
Key: /
Loaded 1008 resources
Average duration: 0.0072023809523809575
jQuery duration: 0.1300000000000002

Key: /with_sw
Loaded 1008 resources
Average duration: 2.1958234126984126
jQuery duration: 2.3145238095238096

Key: /with_dbxsw
Loaded 1008 resources
Average duration: 1.830173611111112
jQuery duration: 2.0142857142857147

Key: /with_faster_dbxsw
Loaded 1008 resources
Average duration: 2.111999007936508
jQuery duration: 2.3633333333333333
```

It seems like you can evict the in-memory cache by switching between a
route with the service worker and a route without it, or with a
different service worker. These are the numbers when running that type
of test in Chrome. Seems like the faster service worker doesn't make
much of a difference on Chrome.

```
Key: /
Loaded 384 resources
Average duration: 21.886445312499998
jQuery duration: 27.63937500000001

Key: /with_sw
Loaded 384 resources
Average duration: 36.59115885416667
jQuery duration: 39.52812500000001

Key: /with_dbxsw
Loaded 528 resources
Average duration: 35.71986742424242
jQuery duration: 39.19545454545455

Key: /with_faster_dbxsw
Loaded 528 resources
Average duration: 34.516676136363635
jQuery duration: 38.21454545454546
```
