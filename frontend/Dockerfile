########################################################################
# 프론트엔드 컨테이너 이미지 (2단계 빌드)
# 1단계: npm ci + vite build 로 정적 파일 생성 (타입 검사 포함)
# 2단계: nginx 가 정적 파일을 제공한다
########################################################################

FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
