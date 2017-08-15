#!/usr/bin/env node

const AWS = require('aws-sdk')
const { execSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const IAM = new AWS.IAM()
const STS = new AWS.STS()

const credentialsFile = join(resolveHome(), '.aws/credentials')
const creds = parseAwsIni(readFileSync(credentialsFile).toString())

const argv = require('yargs')
  .option('token', {
      alias: 't',
      demandOption: true,
      describe: 'Token from your MFA device',
      type: 'string'
  })
  .option('profile', {
      alias: 'p',
      default: process.env.AWS_PROFILE || 'default',
      describe: 'AWS Profile to use for creating session credentials',
      type: 'string'
  })
  .help()
  .argv

run(argv).catch(err => {
  console.log(err.message)
  process.exit(1)
})

async function run(argv) {
  const { token: TokenCode, profile } = argv
  const sessionProfile = argv.sessionProfile || `${profile}-session`

  if (sessionProfile === profile ) {
    throw new Error('You cannot write to the same profile used to retrieve the session credentials')
  }

  const { User: { UserName } } = await IAM.getUser().promise()
  const { MFADevices: [ { SerialNumber } ] } = await IAM.listMFADevices({ UserName }).promise()
  const { Credentials: { AccessKeyId, SecretAccessKey, SessionToken } } = await STS.getSessionToken({ SerialNumber, TokenCode }).promise()

  creds[sessionProfile] = Object.create(null)
  creds[sessionProfile]['aws_access_key_id'] = AccessKeyId
  creds[sessionProfile]['aws_secret_access_key'] = SecretAccessKey
  creds[sessionProfile]['aws_session_token'] = SessionToken

  writeCredentialsFile(creds)

  console.log(`AWS_ACCESS_KEY_ID=${AccessKeyId}`)
  console.log(`AWS_SECRET_ACCESS_KEY=${SecretAccessKey}`)
  console.log(`AWS_SESSION_TOKEN=${SessionToken}`)
  console.log(`Session credentials written to ${sessionProfile}`)
  console.log(`Run "export AWS_PROFILE=${sessionProfile}" to set the default profile for this terminal`)
}

function writeCredentialsFile(creds){
  writeFileSync(credentialsFile, Object.keys(creds).reduce((str, profile) => {
    str = str + `[${profile}]\n`
    Object.keys(creds[profile]).map((key) => str = str + `${key} = ${creds[profile][key]}\n`)
    return str
  }, ""))
}


function parseAwsIni(ini) {
  var section,
      out = Object.create(null),
      re = /^\[([^\]]+)\]\s*$|^([a-z_]+)\s*=\s*(.+?)\s*$/,
      lines = ini.split(/\r?\n/)

  lines.forEach(function(line) {
    var match = line.match(re)
    if (!match) return
    if (match[1]) {
      section = match[1]
      if (out[section] == null) out[section] = Object.create(null)
    } else if (section) {
      out[section][match[2]] = match[3]
    }
  })

  return out
}

function resolveHome() {
  return process.env.HOME || process.env.USERPROFILE || ((process.env.HOMEDRIVE || 'C:') + process.env.HOMEPATH)
}
