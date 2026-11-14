import warnings
from io import BytesIO

from PIL import Image, UnidentifiedImageError


MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_MIMES = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}


class ImageError(Exception):
    def __init__(self, code, status):
        self.code = code
        self.status = status


def validate_image(file):
    data = file.stream.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageError('IMAGE_TOO_LARGE', 413)
    if not data:
        raise ImageError('EMPTY_IMAGE', 400)
    if file.mimetype not in IMAGE_MIMES.values():
        raise ImageError('UNSUPPORTED_IMAGE_FORMAT', 415)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in IMAGE_MIMES:
                    raise ImageError('UNSUPPORTED_IMAGE_FORMAT', 415)
                if IMAGE_MIMES[image.format] != file.mimetype:
                    raise ImageError('IMAGE_MIME_MISMATCH', 400)
                image.verify()
            # verify() checks structure; load() also checks actual pixel decoding.
            with Image.open(BytesIO(data)) as image:
                image.load()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise ImageError('INVALID_IMAGE', 400) from None
    # A generated filename is supplied by the service, never the client filename.
    return BytesIO(data)
