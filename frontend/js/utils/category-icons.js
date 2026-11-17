const icons = new Map([
    ['Thiết bị y tế', 'medical-device'], ['Chăm sóc da mặt', 'skin'],
    ['Mắt - Thị lực', 'eye'], ['Tiêu hóa', 'digestion'], ['Vitamin', 'vitamin'],
    ['Kháng sinh & nấm', 'microbe'], ['Tim mạch & huyết áp', 'heart'],
    ['Thần kinh', 'brain'], ['Cơ xương khớp', 'bone'],
    ['Hô hấp - Tai mũi họng', 'lungs'], ['Sinh lý - nội tiết tố', 'hormones'],
    ['Chăm sóc cá nhân', 'personal-care'], ['Thuốc giảm đau - Hạ sốt - Kháng viêm', 'relief']
].map(([name, icon]) => [normalize(name), icon]));

function normalize(value) {
    return value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}
export const categoryIcon = name => icons.get(normalize(name)) || 'medicine';
