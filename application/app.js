import { connect } from "#modules/database/database"
import { Migrator } from "#modules/database/migrator"
import { initTodos } from "#application/todos/todos"
import { initHealth } from "#application/health/health"
import { cookieSecret } from "#modules/secrets"
import { logger } from "#modules/logger"
import { Edge } from 'edge.js'
import fastify from 'fastify'
import formBody from '@fastify/formbody'
import cors from '@fastify/cors'
import statics from '@fastify/static'
import session from '@fastify/secure-session'
import flash from '@fastify/flash'
import helmet from "@fastify/helmet"

if (!process.env.DB_LOCATION) {
  throw new Error('DB_LOCATION environment variable is missing.')
}

const envs = ['development', 'production']
if (!envs.includes(process.env.NODE_ENV)) {
  throw new Error(`NODE_ENV environment variable must be one of ${envs}.`)
}

const isDevMode = process.env.NODE_ENV !== "production"

export const startApp = async (options = { port: 0 }) => {

  const db = await connect(process.env.DB_LOCATION)

  // In dev mode, we run migrations upon startup.
  // In production, migrations are run by the deployment script.
  if (isDevMode) {
    const migrator = new Migrator(db)
    migrator.migrate()
  }

  // All static assets will have a version number appended at the end.
  // Increment the version number to invalidate the CDN cache.
  const staticVersion = 1;
  const edge = new Edge({ cache: !isDevMode })
  const viewDirectory = process.cwd() + '/views'
  edge.mount('default', viewDirectory)
  edge.global('static', file => file = `${file}?v=${staticVersion}`)

  const app = fastify()

  // Helmet
  app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    }
  })

  // URL-Encoded forms
  app.register(formBody)

  // Cors
  app.register(cors, {
    credentials: true,
    origin: true
  })

  // Sessions
  app.register(session, {
    key: cookieSecret(db)
  })

  // Request logging
  app.addHook('onResponse', (request, reply, done) => {
    logger.info(`${request.method} ${request.url} ${reply.statusCode} - ${Math.round(reply.elapsedTime)}ms`)
    done()
  })

  // Flash scope
  app.register(flash)

  // Static files
  app.register(statics, {
    root: process.cwd() + '/static',
  })

  app.decorateReply('render', async function (view, payload) {
    const currentFlash = this.flash()
    const flash = { errors: currentFlash?.errors?.[0] ?? {}, old: currentFlash?.old?.[0] ?? {} }
    const html = await edge.render(view, { ...payload, flash })
    this.type('text/html')
    this.send(html)
  })

  app.setErrorHandler(async (err, request, reply) => {
    logger.error({ err })
    reply.code(500)
    return 'Oops, something went wrong. Please try again later.'
  })

  app.setNotFoundHandler(async (request, reply) => {
    reply.code(404)
    return "Sorry, this page isn't available."
  })

  await initTodos({ app, db })
  await initHealth({ app, db })

  app.get('/', (request, reply) => {
    reply.redirect('/todos')
  })

  return app.listen(options)
}

