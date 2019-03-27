# aws-sudo

## Why?

It is often necessary to require Multi Factor Authentication (MFA) when using AWS access tokens or performing certain CLI operations. AWS has [documentation](https://aws.amazon.com/premiumsupport/knowledge-center/authenticate-mfa-cli/) on how to do this by issuing expiring access keys using STS. The process is somewhat complex, so this CLI tool automates it for commands that don't have built in support

### Installation

`npm install -g aws-sudo`

## Usage
```
aws-sudo -h
Options:
  --version       Show version number                                  [boolean]
  --token, -t     Token from your MFA device                            [string]
  --duration, -d  Seconds to issue the session token for, defaults to 12 hours
                                                       [number] [default: 43200]
  -h              Show help                                            [boolean]
  ```


`aws-sudo` will prompt you for a token and run your command with the mfa session's env variables set.
```bash
aws-sudo node ./list-buckets.js
# Token: 123456
2017-01-24 12:19:38 your-bucket-here
2017-01-24 12:19:38 your-other-bucket-here
```

The session credentials are cached and checked before running, you'll be prompted for a new code if they expire.


If you don't supply a command it will give you env vars you can eval
```bash
aws-sudo
# Token: 123456
AWS_ACCESS_KEY_ID=ABCDEF232423423; export AWS_ACCESS_KEY_ID;
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxx; export AWS_SECRET_ACCESS_KEY;
AWS_SESSION_TOKEN=xxxxxxxxxxxx; export AWS_SESSION_TOKEN

# to directly eval them
eval $(ssh-agent --token 123456)
```
