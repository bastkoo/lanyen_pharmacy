import re
import uuid
from urllib.parse import urlsplit

import cloudinary.api
import cloudinary.uploader
from cloudinary.exceptions import Error, NotFound
from flask import current_app
from urllib3.exceptions import HTTPError

from app.utils.image_validator import ImageError, validate_image


PRODUCT_FOLDER = 'lan-yen-pharmacy/products'


def credentials():
    names = ('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET')
    values = [current_app.config.get(name, '') for name in names]
    if any(not isinstance(value, str) or not value.strip() for value in values):
        raise ImageError('CLOUDINARY_NOT_CONFIGURED', 503)
    return dict(cloud_name=values[0], api_key=values[1], api_secret=values[2],
                secure=True, upload_prefix='https://api.cloudinary.com', timeout=20)


def canonical_public_id(url, cloud_name):
    """Accept only an original versioned image URL, with no transformations."""
    try:
        if not isinstance(url, str):
            raise ValueError
        parsed = urlsplit(url)
        prefix = '/' + cloud_name + '/image/upload/'
        if (parsed.scheme != 'https' or parsed.netloc != 'res.cloudinary.com' or
                parsed.query or parsed.fragment or not parsed.path.startswith(prefix)):
            raise ValueError
        match = re.fullmatch(r'v[0-9]+/(' + re.escape(PRODUCT_FOLDER) +
                             r'/[A-Za-z0-9_-]+)\.(?:jpg|png|webp)', parsed.path[len(prefix):])
        if match is None:
            raise ValueError
        return match.group(1)
    except (ValueError, TypeError):
        raise ImageError('INVALID_CLOUDINARY_URL', 400) from None


def validate_resource(result, url, public_id):
    return (isinstance(result, dict) and result.get('public_id') == public_id and
            result.get('secure_url') == url and result.get('resource_type') == 'image' and
            result.get('type') == 'upload' and result.get('format') in ('jpg', 'png', 'webp'))


def upload_product_image(file):
    stream = validate_image(file)
    options = credentials()
    name = uuid.uuid4().hex
    public_id = PRODUCT_FOLDER + '/' + name
    try:
        result = cloudinary.uploader.upload(
            stream, **options, folder=PRODUCT_FOLDER, public_id=name,
            resource_type='image', type='upload', overwrite=False,
            use_filename=False, unique_filename=False, allowed_formats=['jpg', 'png', 'webp'])
    except (Error, HTTPError, OSError):
        raise ImageError('CLOUDINARY_UNAVAILABLE', 503) from None
    finally:
        stream.close()
    url = result.get('secure_url') if isinstance(result, dict) else None
    try:
        parsed_id = canonical_public_id(url, options['cloud_name'])
    except ImageError:
        raise ImageError('CLOUDINARY_INVALID_RESPONSE', 502) from None
    if parsed_id != public_id or not validate_resource(result, url, public_id):
        raise ImageError('CLOUDINARY_INVALID_RESPONSE', 502)
    return dict(url=url, public_id=public_id)


def validate_product_image_url(url):
    """External HTTPS URLs remain supported. Verify new standard Cloudinary URLs."""
    try:
        host = (urlsplit(url).hostname or '').encode('idna').decode('ascii').rstrip('.').lower()
    except (ValueError, UnicodeError):
        raise ImageError('INVALID_CLOUDINARY_URL', 400) from None
    if host != 'cloudinary.com' and not host.endswith('.cloudinary.com'):
        return
    options = credentials()
    public_id = canonical_public_id(url, options['cloud_name'])
    try:
        result = cloudinary.api.resource(public_id, **options, resource_type='image', type='upload')
    except NotFound:
        raise ImageError('CLOUDINARY_IMAGE_NOT_FOUND', 400) from None
    except (Error, HTTPError, OSError):
        raise ImageError('CLOUDINARY_UNAVAILABLE', 503) from None
    except Exception:
        raise ImageError('CLOUDINARY_INVALID_RESPONSE', 502) from None
    if not validate_resource(result, url, public_id):
        raise ImageError('INVALID_CLOUDINARY_URL', 400)
