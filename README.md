# Middy caching headers middleware

![github checks](https://badgen.net/github/checks/schibsted/middy-cors)
![current version @ npm](https://badgen.net/npm/v/@schibsted/middy-caching-headers)
![weekly downloads @ npm](https://badgen.net/npm/dw/@schibsted/middy-caching-headers)
![minified size](https://badgen.net//bundlephobia/min/@schibsted/middy-caching-headers)

#### Caching headers middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda

This middleware sets HTTP caching headers, necessary for making the requests cache'able both in browsers and reverse proxies.

Sets headers in `after` and `onError` phases.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @schibsted/middy-caching-headers
```

## Options

- `success` (object) - configuration for the successful requests
- `errors` (object) - configuration for the error requests based on the statusCode

Every section of the config contains 3 properties:

- `directive` (string, optional) - response directive e.g. `must-revalidate`, `public` etc.
- `clientTime` (int) - time to set `max-age` for
- `serverTime` (int) - time to set `s-maxage` for

See the sample usage below.

## Sample usage

```javascript
const middy = require('@middy/core');
const cors = require('@schibsted/middy-caching-headers');

const handler = middy(async () => ({
        statusCode: 200,
        body: JSON.stringify({ foo: 'bar' }),
    }));

handler
  .use(cors({
        success: {
            directive: null,
            serverTime: 3600,
            clientTime: 600,
        },
        errors: {
            default: {
                directive: null,
                serverTime: 5,
                clientTime: 5,
            },
            502: false,
            404: {
                directive: null,
                serverTime: 600,
                clientTime: 600,
            },
        },
    }));

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  expect(response).toEqual({
    statusCode: 200,
    headers:  {
        'cache-control': 'max-age=600,s-maxage=3600',
        'surrogate-control': 'max-age=3600',
    },
    body: JSON.stringify({ foo: 'bar' }),
  })
})
```

## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/schibsted/middy-caching-headers/issues) or to [submit Pull Requests](https://github.com/schibsted/middy-caching-headers/pulls).
