# syntax=docker/dockerfile:1.7
# Laravel 11 backend — single-stage image suitable for dev and small prod.
# Listens on $PORT (default 8000) via Apache + mod_php.
FROM php:8.2-apache

# --- System deps + PHP extensions Laravel + this app need -------------------
# - intl, mbstring, pdo_mysql, bcmath, gd : standard Laravel toolchain
# - exif, zip                              : intervention/image + dompdf
# - gd configured with jpeg/freetype        : image manipulation
RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl unzip ca-certificates \
        libicu-dev libonig-dev libzip-dev \
        libpng-dev libjpeg-dev libfreetype6-dev libwebp-dev \
        default-mysql-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" \
        intl mbstring pdo_mysql bcmath gd exif zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Apache: rewrite + serve from public/
RUN a2enmod rewrite headers
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
        /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# PHP runtime config
RUN { \
        echo "memory_limit=512M"; \
        echo "upload_max_filesize=20M"; \
        echo "post_max_size=20M"; \
        echo "max_execution_time=120"; \
        echo "date.timezone=Asia/Dhaka"; \
    } > /usr/local/etc/php/conf.d/pms.ini

# --- Composer ----------------------------------------------------------------
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# --- App ---------------------------------------------------------------------
WORKDIR /var/www/html

# Install vendors first to leverage Docker layer caching
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction \
    && composer clear-cache

# Copy app source
COPY . .

# Final autoload + storage perms
RUN composer dump-autoload --optimize --no-dev \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

# Apache default port (override via $PORT)
ENV PORT=8000
RUN sed -ri "s!Listen 80!Listen \${PORT}!" /etc/apache2/ports.conf \
    && sed -ri "s!:80>!:\${PORT}>!" /etc/apache2/sites-available/000-default.conf

EXPOSE 8000

# Entrypoint: wait for DB, run migrations, then exec apache
COPY docker/entrypoint.sh /usr/local/bin/pms-entrypoint
RUN chmod +x /usr/local/bin/pms-entrypoint

ENTRYPOINT ["pms-entrypoint"]
CMD ["apache2-foreground"]
