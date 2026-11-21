# build frontend
FROM node:22-alpine AS web_image

# 华为源
# RUN npm config set registry https://repo.huaweicloud.com/repository/npm/

RUN npm install pnpm@8.15.9 -g

WORKDIR /build

COPY ./package.json /build

COPY ./pnpm-lock.yaml /build

RUN pnpm install --frozen-lockfile

COPY . /build

RUN pnpm run build

# build backend
# golang:1.21-alpine3.18 avoids go-sqlite3 musl/CGO build issues on newer Alpine images
FROM golang:1.21-alpine3.18 AS server_image

WORKDIR /build

COPY ./service .

# 中国国内源
# RUN sed -i "s@dl-cdn.alpinelinux.org@mirrors.aliyun.com@g" /etc/apk/repositories \
#     && go env -w GOPROXY=https://goproxy.cn,direct

RUN apk add --no-cache bash curl gcc git musl-dev

RUN go env -w GO111MODULE=on \
    && export PATH=$PATH:/go/bin \
    && go install -a -v github.com/go-bindata/go-bindata/go-bindata@v3.1.2+incompatible \
    && go install -a -v github.com/elazarl/go-bindata-assetfs/go-bindata-assetfs@v1.0.1 \
    && go-bindata-assetfs -o=assets/bindata.go -pkg=assets assets/... \
    && go build -o leon-panel --ldflags="-X leon-panel/global.RUNCODE=release -X leon-panel/global.ISDOCKER=docker" main.go



# run_image
FROM alpine:3.18

WORKDIR /app

COPY --from=web_image /build/dist /app/web

COPY --from=server_image /build/leon-panel /app/leon-panel

# 中国国内源
# RUN sed -i "s@dl-cdn.alpinelinux.org@mirrors.aliyun.com@g" /etc/apk/repositories

EXPOSE 3002

RUN apk add --no-cache bash ca-certificates su-exec tzdata \
    && chmod +x ./leon-panel \
    && ./leon-panel -config

CMD ./leon-panel
