const middy = require('@middy/core');
const createError = require('http-errors');
const middleware = require('./index');

const eventV1 = (httpMethod = 'GET') => ({
    version: '1.0',
    headers: {
        host: 'localhost:3000',
        connection: 'keep-alive',
        'upgrade-insecure-requests': '1',
        'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,nb;q=0.6,no;q=0.5',
    },
    httpMethod,
    path: '/foobar',
});

const eventV2 = (httpMethod = 'GET') => ({
    version: '2.0',
    headers: {
        host: 'localhost:3000',
        connection: 'keep-alive',
        'upgrade-insecure-requests': '1',
        'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,nb;q=0.6,no;q=0.5',
    },
    requestContext: {
        http: {
            method: httpMethod,
            path: '/foobar',
            protocol: 'HTTP/1.1',
            sourceIp: 'IP',
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
        },
    },
    rawPath: '/foobar',
});

const config = {
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
        403: {
            directive: 'private',
            serverTime: 5,
            clientTime: 5,
        },
    },
};

test('Middleware returns all 2 handlers', () => {
    expect(middleware().after).toBeInstanceOf(Function);
    expect(middleware().onError).toBeInstanceOf(Function);
});

describe('V1 payload', () => {
    test('Adds default headers on success when gets no config', async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(middleware());

        const response = await handler(eventV1(), {});
        expect(response).toEqual({
            statusCode: 200,
            headers: {},
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test('Adds default headers on error when gets no config', async () => {
        const handler = middy(async () => {
            throw new createError.InternalServerError('whoops');
        });

        handler.use(middleware());

        await expect(handler(eventV1(), {})).resolves.toMatchObject({
            headers: {},
        });
    });

    test('Adds success headers on success', async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(middleware(config));

        const response = await handler(eventV1(), {});
        expect(response).toEqual({
            statusCode: 200,
            headers: {
                'cache-control': 'max-age=600,s-maxage=3600',
                'surrogate-control': 'max-age=3600',
            },
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test("Doesn't add headers POST request", async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(middleware(config));

        const response = await handler(eventV1('POST'), {});
        expect(response).toEqual({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test('Adds error headers on error when status code matches config', async () => {
        const handler = middy(async () => {
            throw new createError.NotFound();
        });

        handler.use(middleware(config));

        await expect(handler(eventV1(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'max-age=600,s-maxage=600',
                'surrogate-control': 'max-age=600',
            },
        });
    });

    test('Adds cache directive if set', async () => {
        const handler = middy(async () => {
            throw new createError.Forbidden();
        });

        handler.use(middleware(config));

        await expect(handler(eventV1(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'max-age=5,s-maxage=5,private',
                'surrogate-control': 'max-age=5',
            },
        });
    });

    test("Adds default error headers on error when status code doesn't match config", async () => {
        const handler = middy(async () => {
            throw new createError.InternalServerError();
        });

        handler.use(middleware(config));

        await expect(handler(eventV1(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'max-age=5,s-maxage=5',
                'surrogate-control': 'max-age=5',
            },
        });
    });

    test('Adds no cache headers on success if requested', async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(
            middleware({
                success: false,
                errors: {
                    404: {
                        clientTime: 60,
                        serverTime: 600,
                    },
                },
            })
        );

        const response = await handler(eventV1(), {});
        expect(response).toEqual({
            statusCode: 200,
            headers: {
                'cache-control': 'no-cache, no-store',
            },
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test('Adds no cache headers on error if requested', async () => {
        const handler = middy(async () => {
            throw new createError.NotFound();
        });

        handler.use(
            middleware({
                success: {
                    clientTime: 600,
                    serverTime: 3600,
                    directive: 'must-revalidate',
                },
                errors: {
                    404: false,
                },
            })
        );

        await expect(handler(eventV1(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'no-cache, no-store',
            },
        });
    });
});

describe('V2 payload', () => {
    test('Adds default headers on success when gets no config', async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(middleware());

        const response = await handler(eventV2(), {});
        expect(response).toEqual({
            statusCode: 200,
            headers: {},
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test('Adds default headers on error when gets no config', async () => {
        const handler = middy(async () => {
            throw new createError.InternalServerError('whoops');
        });

        handler.use(middleware());

        await expect(handler(eventV2(), {})).resolves.toMatchObject({
            headers: {},
        });
    });

    test('Adds success headers on success', async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(middleware(config));

        const response = await handler(eventV2(), {});
        expect(response).toEqual({
            statusCode: 200,
            headers: {
                'cache-control': 'max-age=600,s-maxage=3600',
                'surrogate-control': 'max-age=3600',
            },
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test("Doesn't add headers POST request", async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(middleware(config));

        const response = await handler(eventV2('POST'), {});
        expect(response).toEqual({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test('Adds error headers on error when status code matches config', async () => {
        const handler = middy(async () => {
            throw new createError.NotFound();
        });

        handler.use(middleware(config));

        await expect(handler(eventV2(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'max-age=600,s-maxage=600',
                'surrogate-control': 'max-age=600',
            },
        });
    });

    test('Adds cache directive if set', async () => {
        const handler = middy(async () => {
            throw new createError.Forbidden();
        });

        handler.use(middleware(config));

        await expect(handler(eventV2(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'max-age=5,s-maxage=5,private',
                'surrogate-control': 'max-age=5',
            },
        });
    });

    test("Adds default error headers on error when status code doesn't match config", async () => {
        const handler = middy(async () => {
            throw new createError.InternalServerError();
        });

        handler.use(middleware(config));

        await expect(handler(eventV2(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'max-age=5,s-maxage=5',
                'surrogate-control': 'max-age=5',
            },
        });
    });

    test('Adds no cache headers on success if requested', async () => {
        const handler = middy(async () => ({
            statusCode: 200,
            body: JSON.stringify({ foo: 'bar' }),
        }));

        handler.use(
            middleware({
                success: false,
                errors: {
                    404: {
                        clientTime: 60,
                        serverTime: 600,
                    },
                },
            })
        );

        const response = await handler(eventV2(), {});
        expect(response).toEqual({
            statusCode: 200,
            headers: {
                'cache-control': 'no-cache, no-store',
            },
            body: JSON.stringify({ foo: 'bar' }),
        });
    });

    test('Adds no cache headers on error if requested', async () => {
        const handler = middy(async () => {
            throw new createError.NotFound();
        });

        handler.use(
            middleware({
                success: {
                    clientTime: 600,
                    serverTime: 3600,
                    directive: 'must-revalidate',
                },
                errors: {
                    404: false,
                },
            })
        );

        await expect(handler(eventV2(), {})).resolves.toMatchObject({
            headers: {
                'cache-control': 'no-cache, no-store',
            },
        });
    });
});
