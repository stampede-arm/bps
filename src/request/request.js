import { getToken } from '../auth/auth'

const aborter = () => {
    let aborted = false
    return {
        abort: () => {
            aborted = true
        },
        abortCheck: wrapped => (promData) => {
            if (!aborted) {
                wrapped(promData)
            }
        },
    }
}

let cacheRes = {}

const clearCache = () => {
    cacheRes = {}
}

const setCache = ({ type, endpoint, res }) => {
    if (cacheRes[endpoint]) {
        cacheRes[endpoint][type] = res
    }
    cacheRes[endpoint] = {
        [type]: res,
    }
}

const getCache = ({ type, endpoint }) => {
    if (cacheRes[endpoint]) {
        return cacheRes[endpoint][type] || null
    }
    return null
}

export default ({
    type = 'GET',
    data,
    endpoint,
    includeToken,
    cached,
}) => {
    const initialCachedResult = getCache({ type, endpoint })
    if (cached && initialCachedResult) {
        return initialCachedResult
    }
    return new Promise(async (promResolve, promReject) => {
        let cachedResolve
        let cachedReject
        if (cached) {
            const cachedDataResult = new Promise((resolve, reject) => {
                cachedResolve = resolve
                cachedReject = reject
            })
            cachedDataResult.catch(() => {})
            setCache({ type, endpoint, res: cachedDataResult })
        }
        const resolve = (resData) => {
            promResolve({
                data: resData,
                cached: false,
            })
            if (cached) {
                cachedResolve({
                    data: resData,
                    cached: true,
                })
            }
        }
        const reject = ({ human = 'An internal error occurred. Try again later.', code = '1-0' }) => {
            const promhuman = Error(human)
            promhuman.cached = false
            promhuman.code = code
            promReject(promhuman)
            if (cached) {
                const cachedPromhuman = Error(human)
                cachedPromhuman.cached = true
                cachedPromhuman.code = code
                cachedReject(cachedPromhuman)
            }
        }
        try {
            const fetchParams = {
                method: type,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: data !== undefined ? JSON.stringify(data) : undefined,
            }
            if (includeToken) {
                fetchParams.headers.Authorization = `Bearer ${getToken()}`
            }
            let fetchResult
            try {
                fetchResult = await fetch(`/.netlify/functions/${endpoint}`, fetchParams)
            } catch (e) {
                reject({ human: 'The server could not be connected to. Try again later.', code: '4-4' })
            }
            const jsonResult = await fetchResult.json()
            if (!jsonResult.code.startsWith('0-')) {
                reject(jsonResult)
                return
            }
            resolve(jsonResult)
        } catch ({ message }) {
            reject({})
        }
    })
}

export { aborter, clearCache }
