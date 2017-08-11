# aws-sudo

## Why?

It is sometimes necessary or useful to require Multi Factor Authentication (MFA) when using AWS access tokens or performing certain CLI operations. AWS has [documentation](https://aws.amazon.com/premiumsupport/knowledge-center/authenticate-mfa-cli/) on how to do this by issuing expiring access keys using STS. The process is somewhat complex, so this CLI tool automates it.

### Installation

`npm install -g aws-sudo`

## Usage

`aws-sudo --token 123456 // Writes temporary MFA associated credentials to a new AWS profile called "default-session"`

`aws-sudo --token 123456 --profile bustle // Writes temporary MFA associated credentials to a new AWS profile called "bustle-session"`
