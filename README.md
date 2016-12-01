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

(Chrome behaves a bit differently: the first request for cached item
will take longer, and then it will be as if every item is "warm" in
memory, the avg duration is 0. Removing/changing the service worker
seems to evict the "warm", in-memory cache. Need to dig into this a
bit more.)

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
