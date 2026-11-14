from flask import jsonify, request

from app.services.cloudinary_service import upload_product_image
from app.utils.image_validator import ImageError


def upload_product():
    if request.mimetype != 'multipart/form-data' or request.args:
        raise ImageError('INVALID_REQUEST', 400)
    if request.form or set(request.files) != {'image'} or len(request.files.getlist('image')) != 1:
        raise ImageError('IMAGE_REQUIRED', 400)
    return jsonify(code='UPLOAD_SUCCESS', data=upload_product_image(request.files['image']))
