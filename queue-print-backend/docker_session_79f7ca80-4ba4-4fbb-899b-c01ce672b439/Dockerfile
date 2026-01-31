
            FROM ubuntu:latest
            RUN apt-get update && apt-get install -y cups cups-client cups-bsd
            RUN usermod -a -G lpadmin root
            ENV CUPS_SERVER=localhost
            ENV CUPS_DEBUG=1
            EXPOSE 631
            CMD ["/usr/sbin/cupsd", "-f"]
        