#!/usr/bin/env node

const AWS = require('aws-sdk')
const childProcess = require('child_process')
const fs = require('fs')
const mkdirp = require('mkdirp')
const os = require('os')
const path = require('path')
const promptly = require('promptly')
const yargs = require('yargs')
const util = require('util')

const writeFileAsync = util.promisify(fs.writeFile)
const readFileAsync = util.promisify(fs.readFile)
const mkdirpAsync = util.promisify(mkdirp)

const configPath = process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'aws-sudo')
  : path.join(os.homedir(), '.aws-sudo')

const askForToken = () => {
  return promptly.prompt('# Token: ', {
    validator(value) {
      if (value.length !== 6) {
        throw new Error('Tokens are 6 characters')
      }
      return value
    }
  })
}

async function chooseMFADevice(devices) {
  if (devices.length == 0) {
    throw new Error('No MFA devices are setup on this account')
  }
  if (devices.length === 1) {
    return devices[0].SerialNumber
  }

  const choice = await promptly.choose('# Choose a MFA device', devices.map(({ SerialNumber, EnableDate }) => `${SerialNumber} - ${EnableDate}`))
  return choice.split(' - ')[0]
}

async function getCredentials({ User, token, duration }) {
  const IAM = new AWS.IAM()
  const STS = new AWS.STS()

  const { UserName, Arn: UserArn } = User

  const { MFADevices } = await IAM.listMFADevices({ UserName }).promise()
  // prompt to pick a device
  const SerialNumber = await chooseMFADevice(MFADevices)
  const TokenCode = token || await askForToken()

  const { Credentials: { AccessKeyId, SecretAccessKey, SessionToken } } = await STS.getSessionToken({ SerialNumber, TokenCode, DurationSeconds: duration }).promise()
  return { UserArn, AccessKeyId, SecretAccessKey, SessionToken }
}

async function readConfig() {
  try {
    const data = await readFileAsync(path.join(configPath, 'config.json'))
    return JSON.parse(data.toString())
  } catch {
    return {}
  }
}

function writeConfig(data) {
  return writeFileAsync(path.join(configPath, 'config.json'), JSON.stringify(data))
}

async function cacheCreds(creds) {
  await mkdirpAsync(configPath)
  const { UserArn } = creds
  const config = await readConfig()
  const newConfig = {
    ...config,
    [UserArn]: creds
  }
  await writeConfig(newConfig)
}

async function fetchValidCachedCreds(UserArn) {
  const config = await readConfig()
  const creds = config[UserArn]
  if (!creds) {
    return null
  }
  const IAM = new AWS.IAM({
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken
  })
  try {
    await IAM.getUser().promise()
    return creds
  } catch {
    return null
  }
}

function exec(input, creds) {
  const { AccessKeyId, SecretAccessKey, SessionToken } = creds
  if (input.length === 0) {
    console.log(`AWS_ACCESS_KEY_ID=${AccessKeyId}; export AWS_ACCESS_KEY_ID;`)
    console.log(`AWS_SECRET_ACCESS_KEY=${SecretAccessKey}; export AWS_SECRET_ACCESS_KEY;`)
    console.log(`AWS_SESSION_TOKEN=${SessionToken}; export AWS_SESSION_TOKEN`)
    return
  }
  const [cmd, ...args] = input
  const opts = {
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: AccessKeyId,
      AWS_SECRET_ACCESS_KEY: SecretAccessKey,
      AWS_SESSION_TOKEN: SessionToken,
    },
    stdio: 'inherit',
    shell: true,
  }
  const child = childProcess.spawn(cmd, args, opts)
  child.on('error', err => {
    console.error(err)
    process.exit(1)
  })
  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`terminated by ${signal}`)
      process.exit(1)
    }
    process.exit(code)
  })
}

async function run({ token, duration, _: command }) {
  const IAM = new AWS.IAM()
  const { User } = await IAM.getUser().promise()

  const cachedCreds = await fetchValidCachedCreds(User.Arn)
  if (cachedCreds) {
    exec(command, cachedCreds)
    return
  }

  const creds = await getCredentials({ User, token, duration })
  await cacheCreds(creds)
  exec(command, creds)
}


const argv = yargs
  .option('token', {
    alias: 't',
    demandOption: false,
    describe: 'Token from your MFA device',
    type: 'string'
  })
  .option('duration', {
    alias: 'd',
    default: 43200,
    describe: 'Seconds to issue the session token for, defaults to 12 hours',
    type: 'number'
  })
  .help('h')
  .argv

run(argv).catch(err => {
  console.log(err.message)
  process.exit(1)
})
