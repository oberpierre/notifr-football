# notifR football service


## Getting started

This project used node@^12.0 and yarn.
To install the dependencies run the following command in the root of this project.
```
yarn && yarn bootstrap
```

This will install the dependencies and also link the two subprojects feed-poller and object-normalizer as dependencies of the football microservice.

### Testing

For testing you can either run `yarn test` in the root of the project which will subsequently go into all subprojects in packages and execute their tests in parrallel. Alternatively you may execute `yarn test` in any of the subpackages to execute only its tests.

## Start

To start the service set the BACKEND_HOST, PUBLISH_KEY and SUBSCRIBE_KEY environment variables and run `yarn start` in either root or packages/football-microservice.