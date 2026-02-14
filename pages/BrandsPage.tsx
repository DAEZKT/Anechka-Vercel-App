
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { brandService } from '../services/supabaseService';
import { Brand } from '../types';

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
    ),
    Edit: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
    ),
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
    ),
    Image: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
    )
};

export const BrandsPage: React.FC = () => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        image_url: '',
        is_active: true
    });

    useEffect(() => {
        loadBrands();
    }, []);

    const loadBrands = async () => {
        setLoading(true);
        try {
            const data = await brandService.getAll();
            setBrands(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        setLoading(true);
        try {
            if (editingBrand) {
                await brandService.update(editingBrand.id, formData);
            } else {
                await brandService.create(formData);
            }
            loadBrands();
            closeModal();
        } catch (error) {
            alert("Error al guardar marca");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Eliminar esta marca?")) {
            try {
                await brandService.delete(id);
                loadBrands();
            } catch (error) {
                alert("Error al eliminar");
            }
        }
    };

    const openModal = (brand?: Brand) => {
        if (brand) {
            setEditingBrand(brand);
            setFormData({
                name: brand.name,
                image_url: brand.image_url || '',
                is_active: brand.is_active
            });
        } else {
            setEditingBrand(null);
            setFormData({
                name: '',
                image_url: '',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingBrand(null);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, image_url: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Marcas</h2>
                    <p className="text-gray-500">Gestión de marcas de productos</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="w-full md:w-auto bg-brand-primary text-white px-4 py-3 md:py-2 rounded-xl md:rounded-lg flex items-center justify-center gap-2 font-bold hover:shadow-lg transition-all active:scale-95 shadow-md shadow-brand-primary/20"
                >
                    <Icons.Plus /> Nueva Marca
                </button>
            </div>

            <GlassCard>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider text-xs">
                                <th className="py-3 px-4">Imagen</th>
                                <th className="py-3 px-4">Nombre</th>
                                <th className="py-3 px-4">Slug</th>
                                <th className="py-3 px-4">Estado</th>
                                <th className="py-3 px-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {brands.map(brand => (
                                <tr key={brand.id} className="hover:bg-white/40 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                                            {brand.image_url ? (
                                                <img src={brand.image_url} alt={brand.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-gray-300"><Icons.Image /></span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-bold text-gray-700">{brand.name}</td>
                                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{brand.slug}</td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${brand.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {brand.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openModal(brand)} className="p-1 hover:bg-gray-100 rounded text-blue-500"><Icons.Edit /></button>
                                            <button onClick={() => handleDelete(brand.id)} className="p-1 hover:bg-gray-100 rounded text-red-500"><Icons.Trash /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {brands.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-400">No hay marcas registradas.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="font-bold text-xl mb-4 text-gray-800">{editingBrand ? 'Editar Marca' : 'Nueva Marca'}</h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                    placeholder="Ej: Nike"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Imagen (Logo)</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 relative group">
                                        {formData.image_url ? (
                                            <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-gray-300"><Icons.Image /></span>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            title="Cambiar imagen"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-500">Haz clic en la imagen para subir un logo.</p>
                                        {formData.image_url && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, image_url: '' })}
                                                className="text-xs text-red-500 font-bold mt-1 hover:underline"
                                            >
                                                Quitar Imagen
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Marca Activa</label>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-50 mt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
