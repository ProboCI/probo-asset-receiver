# ProboCI
# https://www.probo.ci

FROM node:12

RUN useradd --user-group --create-home --shell /bin/false probo
RUN mkdir -p /home/probo/app
COPY . /home/probo/app
RUN chown -R probo:probo /home/probo/app

RUN cd /home/probo/app/ && npm install

WORKDIR /home/probo/app

EXPOSE 3070

VOLUME ["/opt/db"]

CMD ["sh", "/home/probo/app/bin/startup.sh"]