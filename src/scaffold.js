import fs from "fs";
import path from "path";

import minimist from "minimist";
import Promise from "bluebird";

import setupServer from "./setup-server";
import writeMocks from "./write-mocks";
import importHar from "./import-har";
import text from "./text";
import { printRow } from "./util";


function trapFirstCtrlC () {
  let firstCtrlC = true;
  return new Promise(resolve => {
    process.on("SIGINT", () => {
      if (!firstCtrlC) {
        console.log("\nexiting early...\n");
        process.exit();
      }
      firstCtrlC = false;
      resolve();
    });
  });
}

function main (options) {
  const {
    ip = "0.0.0.0",
    port = 1337,
    destination = process.cwd()
  } = options;

  let getTransactions;
  if (options._.length && options._[0] === "import") {
    const filepath = path.resolve(process.cwd(), options._[1]);
    getTransactions = doImport(filepath, options._[2]);
  } else {
    getTransactions = runProxy(options);
  }

  getTransactions
    .then(transactions => {
      console.log("writing mocks to disk...")
      return writeMocks(ip, port, destination, transactions);
    })
    .then(() => {
      console.log("finished!");
      console.log("");
      console.log("If you haven't done so, you'll want to install a couple of node modules:");
      console.log("  npm install --save drydock yargs lodash");
    });
}

function runProxy (options) {
  const {
    ip = "0.0.0.0",
    port = 1337
  } = options;

  const transactions = [];

  function onRequest({ method, hostname, pathname, href, transactionNo }) {
    printRow(transactionNo, text(method.toUpperCase()).yellow(), href);
    transactions[transactionNo] = { method, hostname, pathname, href };
  }

  function onResponse({ statusCode, method, href, transactionNo, body, headers }) {
    const color = statusCode >= 200 && statusCode < 300 ? "green" : "red";
    printRow(transactionNo, text(method.toUpperCase())[color](), href);

    Object.assign(transactions[transactionNo], {
      statusCode,
      responseBody: body,
      responseHeaders: headers
    });
  }

  function onError(transactionNo) {
    transactions[transactionNo] = null;
  }

  const [ start, stop ] = setupServer({ ip, port }, onRequest, onResponse, onError);

  return Promise.resolve()
    .then(() => {
      console.log(
        "\nWhen started, the proxy server will forward any HTTP(S) requests along to\n" +
        "the intended servers.  Responses will be relayed back to the originating\n" +
        "client, and all transactions will be recorded.\n\n" +
        "Once you have captured all desired API interactions, press CTRL-C to stop\n" +
        "the proxy server, and mocks will be written to disk.\n\n---\n"
      );
      console.log(`starting proxy server on http://${ip}:${port}...`);
      return start();
    })
    .then(trapFirstCtrlC)
    .then(() => {
      console.log("\nstopping server...");
      return stop();
    })
    .then(() => console.log("server stopped, press CTRL-C immediately to avoid writing to disk..."))
    .delay(3000)
    .then(() => transactions);
}

function doImport(filepath, filter) {
  return Promise.resolve()
    .then(() => {
      console.log("importing HAR file...");
      console.log("filter:" + filter);
      return importHar(filepath, filter);
    });
}

main(minimist(process.argv.slice(2)));
