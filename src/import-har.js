import fs from "fs";
import url from "url";
_ = require("lodash");

export default function (filepath, filter) {
  const harRaw = fs.readFileSync(filepath);
  const har = JSON.parse(harRaw);

  let entries = har.log.entries;
  if (filter !== undefined) {
    let match = new RegExp(filter, "g");
    let entriesTemp = _.filter(entries, function(entry) {
      let entryUrl = url.parse(entry.request.url);
      let testResult = match.test(entryUrl.pathname);
      return testResult;
    });
    entries = entriesTemp;
  }

  return entries.map(entry => {
    const entryUrl = url.parse(entry.request.url);

    return {
      method: entry.request.method,
      hostname: entryUrl.hostname,
      pathname: entryUrl.pathname.endsWith('/') 
        ? entryUrl.pathname.substring(0, entryUrl.pathname.length-1) : entryUrl.pathname,
      href: entryUrl.href,
      statusCode: entry.response.status,
      responseBody: entry.response.content.text,
      responseHeaders: entry.response.headers.reduce((obj, header) => {
        obj[header.name] = header.value;
        return obj;
      }, {}),
      hadError: false
    };
  });
}
