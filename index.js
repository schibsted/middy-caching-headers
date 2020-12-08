const R = require('ramda');

const ignoreMethods = ['post', 'put', 'patch', 'delete'];
const cacheHeaders = ['expires', 'cache-control'];

const cacheHeadersAlreadySet = (response) =>
    R.pipe(R.propOr([], 'headers'), R.pick(cacheHeaders), R.filter(Boolean), R.keys)(response).length > 0;

const generateCacheHeaders = (routeSettings, currentHeaders = {}) => {
    const generatedHeaders = currentHeaders;

    if (routeSettings !== false) {
        // First check if we have client and varnish max age defined in the route config
        // If we don't have, see if we have standard maxAge options, if not fallback to server defaults
        const cacheControl = {
            maxAge: R.prop('clientTime', routeSettings),
            sMaxAge: R.prop('serverTime', routeSettings),
            directive: R.propOr('', 'directive', routeSettings),
        };

        if (R.isNil(cacheControl.maxAge)) {
            return generatedHeaders;
        }

        // max-age is how long the client will cache the response
        // s-maxage is how long varnish will cache the response
        if (!currentHeaders['cache-control']) {
            generatedHeaders['cache-control'] = `max-age=${cacheControl.maxAge},s-maxage=${cacheControl.sMaxAge}${
                cacheControl.directive ? `,${cacheControl.directive}` : ''
            }`;
        }

        if (!currentHeaders['surrogate-control']) {
            generatedHeaders['surrogate-control'] = `max-age=${cacheControl.sMaxAge}`;
        }
    } else {
        generatedHeaders['cache-control'] = 'no-cache, no-store';
    }

    return generatedHeaders;
};

const shouldAddCachingHeaders = (handler) => {
    if (ignoreMethods.includes(handler.event.httpMethod.toLowerCase())) {
        return false;
    }

    // Don't touch headers if something else has already set them
    if (cacheHeadersAlreadySet(handler.response)) {
        return false;
    }

    return true;
};

const cachingMiddleware = ({ success = {}, errors = {} } = {}) => ({
    after: async (handler) => {
        if (!shouldAddCachingHeaders(handler)) {
            return;
        }

        // eslint-disable-next-line no-param-reassign
        handler.response.headers = generateCacheHeaders(success, handler.response.headers);
    },
    onError: async (handler) => {
        if (!shouldAddCachingHeaders(handler)) {
            return handler;
        }

        const errorCacheConfiguration = R.propOr(R.prop('default', errors), handler.error.statusCode, errors);

        // eslint-disable-next-line no-param-reassign
        handler.response = R.assocPath(
            ['headers'],
            generateCacheHeaders(errorCacheConfiguration, R.path(['response', 'headers'], handler)),
            handler.response
        );

        return handler;
    },
});

module.exports = cachingMiddleware;
