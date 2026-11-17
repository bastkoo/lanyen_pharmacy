from flask import current_app, jsonify, request

from app.services.cloudinary_service import upload_product_image, upload_avatar_image
from app.utils.image_validator import ImageError


def upload_product():
    return upload(upload_product_image)


def upload_avatar():
    try:
        return upload(upload_avatar_image)
    except ImageError:
        raise
    except Exception:
        current_app.logger.error('Avatar upload failed unexpectedly')
        return jsonify(code='UPLOAD_FAILED'), 500


def upload(handler):
    if request.mimetype != 'multipart/form-data' or request.args:
        raise ImageError('INVALID_REQUEST', 400)
    if request.form or set(request.files) != {'image'} or len(request.files.getlist('image')) != 1:
        raise ImageError('IMAGE_REQUIRED', 400)
    return jsonify(code='UPLOAD_SUCCESS', data=handler(request.files['image']))
