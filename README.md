<div align="center">
<img src="./docs/images/icon.svg" alt="icon"/>

<h1 align="center">Agents Builder</h1>

<!--English / [简体中文](./README_CN.md)-->


[Demo](http://18.116.115.123:3000/) / [Issues](https://github.com/Yidadaa/ChatGPT-Next-Web/issues) 


</div>

## Features

- [x] Define you own agents to talk
- [x] Chat with PDF
- [x] Teach the agents and build you own knowledge base
- [x] Text2Speech supported
- [x] Create you own chat group and let them talk!
- [x] Start Rule base and apply different rule to soomth your chat!
- [ ] Share your own agents with others!(Coming feature)

## What's New

- 🚀 v2.0 is released, now you can use multiple model in one group!
- 🚀 v2.1 is under test, you can comment with new feature you want


## How this Arcticture work?
Check [here](https://github.com/xzwDavid/ChatGPT-Next-Web/blob/latest-chatbot/Arcticture.md)

## Supported Metrics
| compatibility | Langchain | Rules | Group | muti-model |
|---------------|-----------|-------|-------|------------|
| langchain     |     ✔︎     |  ✔︎   |  ✔︎   |     ✘     |
| Rules         |     ✔︎     |  ✔︎   |  ✘   |     ✘     |
| Group         |     ✔︎     |  ✘   |  ✔︎   |     ✔︎     |
| muti-model    |     ✘     |  ✘   |  ✔︎   |     ✔︎     |


## Deployment and Develop instruction

### Deploy the demo

```shell
# 1. install nodejs and yarn first
# 2. install deps with yarn
yarn install
# 3. for develop
yarn run dev
# for deploy
yarn build && yarn run start
```
### Deploy the langchain
```shell
# navigate to langchain dir($root/langchain)
# follow the instruction here
```
### Launch the server
```shell
# launcher the server
# follow the instruction there
```

## Screenshots

![Settings](https://github.com/xzwDavid/ChatGPT-Next-Web/blob/latest-chatbot/public/start.png)

![More](https://github.com/xzwDavid/ChatGPT-Next-Web/blob/latest-chatbot/public/group.png)


## LICENSE

[Anti 996 License](https://github.com/kattgu7/Anti-996-License/blob/master/LICENSE_CN_EN)
