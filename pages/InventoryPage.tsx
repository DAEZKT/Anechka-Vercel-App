
import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GlassCard } from '../components/GlassCard';
import { productService, inventoryService, categoryService, auditService, brandService } from '../services/supabaseService';
import { Product, User, MovementType, ProductGender, Category, InventoryMovementHeader, InventoryMovementDetail, AuditSession, Brand } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { ScannerModal } from '../components/ScannerModal';

interface InventoryPageProps {
  user: User;
  initialView: 'STOCK' | 'MOVEMENT' | 'CATALOG' | 'KARDEX' | 'AUDIT';
}

interface PendingItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  newPrice?: number;
}

// Conceptos definidos por regla de negocio
const MOVEMENT_CONCEPTS = {
  IN: ['Compra', 'Concesión', 'Devolución de Producto'],
  OUT: ['Retiro de Producto', 'Regalía']
};

const INITIAL_PRODUCT_FORM = {
  sku: '',
  name: '',
  brand: '',
  brand_id: '',
  color: '',
  description: '',
  category_id: '',
  min_stock: 5,
  gender: 'UNISEX' as ProductGender,
  size: '',
  image_url: ''
};

// --- ICONS (Lucide Style SVGs) ---
const Icons = {
  Camera: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
  ),
  Barcode: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5v14" /><path d="M8 5v14" /><path d="M12 5v14" /><path d="M17 5v14" /><path d="M21 5v14" /></svg>
  ),
  Upload: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
  ),
  Image: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
  ),
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ),
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  Eye: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  X: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  ),
  Edit: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
  ),
  ChevronDown: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  ),
  Shutter: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  FileText: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
  )
};

export const InventoryPage: React.FC<InventoryPageProps> = ({ user, initialView }) => {
  const [currentView, setCurrentView] = useState(initialView);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STOCK VIEW STATE ---
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [totalInvestment, setTotalInvestment] = useState(0);

  // --- KARDEX STATE ---
  const [movements, setMovements] = useState<InventoryMovementHeader[]>([]);
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovementHeader | null>(null);
  const [movementDetails, setMovementDetails] = useState<InventoryMovementDetail[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // --- MOVEMENT STATE ---
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<MovementType>('IN');
  const [movementConcept, setMovementConcept] = useState('');
  const [reason, setReason] = useState('');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  // Detalle inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementSku, setMovementSku] = useState('');
  const [qtyInput, setQtyInput] = useState(1);
  const [costInput, setCostInput] = useState(0);
  const [priceInputState, setPriceInput] = useState(0);
  const [showProductResults, setShowProductResults] = useState(false); // New State for Autocomplete

  // --- PRODUCT REGISTRY / EDIT STATE ---
  const [newProduct, setNewProduct] = useState(INITIAL_PRODUCT_FORM);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // --- SCANNER STATE ---
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // --- AUDIT STATE ---
  const [auditItems, setAuditItems] = useState<Record<string, number>>({}); // productId -> physical qty
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'DIFF'>('ALL');
  const [activeAuditSession, setActiveAuditSession] = useState<AuditSession | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditSession[]>([]);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  // --- INDEPENDENT SEARCH STATES ---
  const [itemSearchTerm, setItemSearchTerm] = useState(''); // Specific for Movement Item Search

  // --- CAMERA (PHOTO) STATE ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync props to state and RESET if navigating to MOVEMENT via menu
  useEffect(() => {
    setCurrentView(initialView);

    // Logic: If user clicks "Movimientos" in menu, they probably want a NEW movement,
    // so we clear any potential stale "Edit Mode" state.
    if (initialView === 'MOVEMENT') {
      setEditingMovementId(null);
      setMovementType('IN');
      setMovementConcept('');
      setReason('');
      setPendingItems([]);

      // Clean detail inputs too
      setSelectedProductId('');
      setMovementSku('');
      setItemSearchTerm(''); // Clear item search
      setQtyInput(1);
      setCostInput(0);
      setPriceInput(0);
    }
  }, [initialView]);

  // --- WINDOW UNLOAD PROTECTION (Refresh / Close Tab) ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentView === 'CATALOG') {
        const isNewMode = !editingProduct;
        const baseline = isNewMode ? INITIAL_PRODUCT_FORM : {
          sku: editingProduct?.sku || '',
          name: editingProduct?.name || '',
          brand: editingProduct?.brand || '',
          brand_id: editingProduct?.brand_id || '',
          color: editingProduct?.color || '',
          description: editingProduct?.description || '',
          category_id: editingProduct?.category_id || '',
          min_stock: editingProduct?.min_stock || 0,
          gender: editingProduct?.gender || 'UNISEX',
          size: editingProduct?.size || '',
          image_url: editingProduct?.image_url || ''
        };

        // Note: We use JSON.stringify for deep comparison of simple objects
        if (JSON.stringify(newProduct) !== JSON.stringify(baseline)) {
          e.preventDefault();
          e.returnValue = ''; // Chrome requires returnValue to be set
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentView, newProduct, editingProduct]);

  const refreshData = async () => {
    setLoading(true);
    const [prods, cats, brnds] = await Promise.all([
      productService.getAll(),
      categoryService.getAll(),
      brandService.getAll(true) // Only active brands
    ]);
    setProducts(prods);
    setCategories(cats);
    setBrands(brnds);

    // Calculate Total Investment (Cost * Stock)
    // Calculate Total Investment (Cost * Stock) using the fetched products directly
    // This avoids N+1 API calls and ensures consistency with the displayed stock
    const totalInv = prods.reduce((sum, p) => sum + (p.cost * p.stock_level), 0);
    setTotalInvestment(totalInv);

    if (currentView === 'KARDEX') {
      const movs = await inventoryService.getAllMovements();
      setMovements(movs);

      // Refresh modal details if open
      if (selectedMovement && isDetailModalOpen) {
        const details = await inventoryService.getMovementDetails(selectedMovement.id);
        const updatedHeader = movs.find(m => m.id === selectedMovement.id);
        if (updatedHeader) {
          setSelectedMovement(updatedHeader);
          setMovementDetails(details);
        } else {
          setIsDetailModalOpen(false);
        }
      }
    } else if (currentView === 'AUDIT') {
      const session = await auditService.getParameterActiveSession();
      setActiveAuditSession(session);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, [currentView]);

  // Load product data into form when editingProduct changes
  useEffect(() => {
    if (editingProduct && currentView === 'CATALOG') {
      setNewProduct({
        sku: editingProduct.sku,
        name: editingProduct.name,
        brand: editingProduct.brand,
        brand_id: editingProduct.brand_id || '',
        color: editingProduct.color,
        description: editingProduct.description,
        category_id: editingProduct.category_id,
        min_stock: editingProduct.min_stock,
        gender: editingProduct.gender,
        image_url: editingProduct.image_url
      });
    } else if (!editingProduct && currentView === 'CATALOG') {
      setNewProduct(INITIAL_PRODUCT_FORM);
    }
  }, [editingProduct, currentView]);

  // Reset concept when type changes
  useEffect(() => {
    setMovementConcept('');
  }, [movementType]);

  // AUTO-FILL COST AND PRICE WHEN PRODUCT SELECTED
  useEffect(() => {
    const fetchData = async () => {
      if (selectedProductId) {
        const p = products.find(prod => prod.id === selectedProductId);
        if (p) {
          // Get current sales price from master data
          setPriceInput(p.price);

          // Get last known COST from history
          const lastCost = await inventoryService.getLastProductCost(p.id);
          setCostInput(lastCost);
        }
      }
    };
    fetchData();
  }, [selectedProductId, products]);

  // --- SCANNER LOGIC REPLACED BY MODAL ---
  const handleScanSuccess = (decodedText: string) => {
    console.log("Scanned:", decodedText);

    if (currentView === 'CATALOG') {
      // If in Catalog (New Product), just fill SKU field
      setNewProduct(prev => ({ ...prev, sku: decodedText }));
    } else if (currentView === 'MOVEMENT') {
      // If in Movement, fill SKU AND try to select product
      setMovementSku(decodedText);

      // Auto-find product in available list
      const foundProduct = products.find(p => p.sku.toLowerCase() === decodedText.toLowerCase());
      if (foundProduct) {
        setSelectedProductId(foundProduct.id);
      } else {
        alert(`Producto con SKU ${decodedText} no encontrado en el sistema.`);
      }
    } else if (currentView === 'AUDIT') {
      // If in Audit, find product and FOCUS/INCREMENT
      // Try fuzzy match
      const foundProduct = products.find(p => p.sku.toLowerCase() === decodedText.toLowerCase());
      if (foundProduct) {
        setAuditItems(prev => ({
          ...prev,
          [foundProduct.id]: (prev[foundProduct.id] || 0) + 1
        }));
        // Beep is handled by modal
      } else {
        alert("Producto no encontrado en auditoría.");
      }
    }

    setIsScanning(false);
  };

  const handleCloseScanner = () => {
    setIsScanning(false);
  };

  // --- CAMERA PHOTO LOGIC (For Product Images) ---
  useEffect(() => {
    if (isCameraOpen) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera Error", err);
          alert("No se pudo acceder a la cámara para tomar fotos.");
          setIsCameraOpen(false);
        }
      };
      startCamera();
    }

    return () => {
      // Stop all tracks when closing
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Match canvas size to video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Convert to Base64 JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setNewProduct(prev => ({ ...prev, image_url: dataUrl }));
        setIsCameraOpen(false);
      }
    }
  };

  const handleCloseCamera = () => {
    setIsCameraOpen(false);
  };

  // --- KARDEX HANDLERS ---
  const handleViewDetails = async (movement: InventoryMovementHeader) => {
    setLoading(true);
    try {
      const details = await inventoryService.getMovementDetails(movement.id);
      setSelectedMovement(movement);
      setMovementDetails(details);
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error(error);
      alert("Error al cargar detalles");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMovement = async (movement: InventoryMovementHeader) => {
    setLoading(true);
    try {
      // 1. Fetch details
      const details = await inventoryService.getMovementDetails(movement.id);

      // 2. Parse Concept/Reason. Format: "[Concept] Reason"
      const match = movement.reason.match(/^\[(.*?)\] (.*)$/);
      const concept = match ? match[1] : '';
      const cleanReason = match ? match[2] : movement.reason;

      // 3. Map details to pendingItems form format
      const mappedItems: PendingItem[] = details.map(d => {
        const p = products.find(prod => prod.id === d.product_id);
        return {
          productId: d.product_id,
          productName: p ? p.name : 'Unknown Product',
          quantity: d.quantity,
          unitCost: d.unit_cost,
          newPrice: d.new_price
        };
      });

      // 4. Set State & Switch View
      setMovementType(movement.type);
      setMovementConcept(concept); // Note: Ensure concept exists in current MOVEMENT_CONCEPTS list or select handles it gracefully
      setReason(cleanReason);
      setPendingItems(mappedItems);
      setEditingMovementId(movement.id);

      setCurrentView('MOVEMENT');

    } catch (error) {
      console.error(error);
      alert("Error al cargar movimiento para edición.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (window.confirm("¿Está seguro de eliminar este movimiento COMPLETO? Esta acción revertirá los cambios en el stock.")) {
      setLoading(true);
      try {
        const result = await inventoryService.deleteMovement(movementId);
        if (result.success) {
          alert("Movimiento eliminado y stock revertido.");
          refreshData();
        } else {
          alert("Error al eliminar.");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteDetailRow = async (detailId: string) => {
    if (window.confirm("¿Eliminar esta línea del registro? Se ajustará el stock.")) {
      setLoading(true);
      try {
        const result = await inventoryService.deleteMovementDetail(detailId);
        if (result.success) refreshData();
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Producto desconocido';
  };

  // --- MOVEMENT HANDLERS ---
  const availableProducts = products.filter(p => !pendingItems.some(item => item.productId === p.id));

  const handleAddItem = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    if (pendingItems.some(item => item.productId === product.id)) {
      alert("Este producto ya está en el detalle.");
      return;
    }
    if (qtyInput <= 0) {
      alert("Cantidad debe ser > 0");
      return;
    }

    setPendingItems(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        quantity: qtyInput,
        unitCost: costInput,
        newPrice: movementType === 'IN' ? priceInputState : undefined
      }
    ]);

    setSelectedProductId('');
    setMovementSku('');
    setItemSearchTerm(''); // Clear item search
    setQtyInput(1);
    setCostInput(0);
    setPriceInput(0);
  };

  const handleRemoveItem = (index: number) => {
    setPendingItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number) => {
    const itemToEdit = pendingItems[index];

    // 1. Populate Form Inputs with item values
    setSelectedProductId(itemToEdit.productId);
    setQtyInput(itemToEdit.quantity);
    setCostInput(itemToEdit.unitCost);
    if (itemToEdit.newPrice) setPriceInput(itemToEdit.newPrice);

    // 2. Populate SKU for visual consistency (UX)
    const prod = products.find(p => p.id === itemToEdit.productId);
    if (prod) setMovementSku(prod.sku);

    // 3. Remove from list (so user can re-add updated version)
    setPendingItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleMovementScan = () => {
    if (products.length === 0) return;
    let foundProduct: Product | undefined;

    if (movementSku) {
      foundProduct = products.find(p => p.sku.toLowerCase() === movementSku.toLowerCase());
    } else {
      const avail = availableProducts;
      if (avail.length > 0) {
        foundProduct = avail[Math.floor(Math.random() * avail.length)];
        setMovementSku(foundProduct.sku);
      }
    }

    if (foundProduct) {
      if (pendingItems.some(i => i.productId === foundProduct.id)) {
        alert(`"${foundProduct.name}" ya agregado.`);
        setMovementSku('');
      } else {
        setSelectedProductId(foundProduct.id);
      }
    } else {
      alert("Producto no encontrado.");
    }
  };

  const cancelEdit = () => {
    setEditingMovementId(null);
    setPendingItems([]);
    setReason('');
    setMovementConcept('');
    setCurrentView('KARDEX');
  };

  const handleSubmitMovement = async () => {
    if (!movementConcept) {
      alert("Seleccione un Concepto.");
      return;
    }
    if (!reason.trim()) {
      alert("Ingrese glosa.");
      return;
    }
    if (pendingItems.length === 0) {
      alert("Agregue productos al detalle.");
      return;
    }

    setLoading(true);
    try {
      const fullReason = `[${movementConcept}] ${reason}`;

      let result;
      if (editingMovementId) {
        // UPDATE MODE
        result = await inventoryService.updateMovement(
          editingMovementId,
          user.id,
          movementType,
          fullReason,
          pendingItems
        );
        if (result.success) {
          alert("Movimiento actualizado correctamente.");

          // --- RESET STATE AFTER SUCCESSFUL UPDATE ---
          setEditingMovementId(null);
          setPendingItems([]);
          setReason('');
          setMovementConcept('');
          setMovementType('IN');
          setQtyInput(1);
          setCostInput(0);
          setPriceInput(0);
          setSelectedProductId('');

          setCurrentView('KARDEX');
        } else {
          alert(`Error al actualizar movimiento: ${result.error || 'Desconocido'}`);
        }
      } else {
        // CREATE MODE
        result = await inventoryService.createMovement(
          user.id,
          movementType,
          fullReason,
          pendingItems
        );
        if (result.success) {
          alert(`Movimiento registrado: ${result.movementId}`);

          // Reset State after Create
          setPendingItems([]);
          setReason('');
          setMovementConcept('');
          setMovementType('IN');

          await refreshData();
          setCurrentView('KARDEX');
        } else {
          alert(`Error al registrar movimiento: ${result.error || 'Desconocido'}`);
        }
      }

      if (result.success && !editingMovementId && currentView !== 'KARDEX') {
        setPendingItems([]);
        setReason('');
        setMovementConcept('');
        refreshData();
      }
    } catch (e) {
      console.error(e);
      alert("Error al procesar movimiento");
    } finally {
      setLoading(false);
    }
  };

  // --- PRODUCT HANDLERS ---
  const handleProductChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProduct(prev => ({
      ...prev,
      [name]: name === 'min_stock' ? parseFloat(value) : value
    }));
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const brandId = e.target.value;
    const brandName = brands.find(b => b.id === brandId)?.name || '';
    setNewProduct(prev => ({
      ...prev,
      brand_id: brandId,
      brand: brandName
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate brand_id effectively
    if (!newProduct.sku || !newProduct.name || !newProduct.category_id || (!newProduct.brand_id && !newProduct.brand)) {
      alert("Complete campos obligatorios (SKU, Nombre, Categoría, Marca).");
      return;
    }
    setLoading(true);
    try {
      let result;

      if (editingProduct) {
        // UPDATE MODE
        result = await productService.updateProduct(editingProduct.id, newProduct);
      } else {
        // CREATE MODE
        result = await productService.createProduct(newProduct);
      }

      if (result.success) {
        alert(editingProduct ? "Producto actualizado." : "Producto registrado.");
        setNewProduct(INITIAL_PRODUCT_FORM);
        setEditingProduct(null); // Clear editing state
        // REDIRECT TO STOCK
        await refreshData();
        setCurrentView('STOCK');
      }
    } catch (error) {
      console.error(error);
      alert("Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    setCurrentView('CATALOG');
  };

  // --- STOCK VIEW FILTERS ---
  const filteredStock = products.filter(p => {
    const term = stockSearchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      (p.size && p.size.toLowerCase().includes(term)) ||
      (p.category_name && p.category_name.toLowerCase().includes(term))
    );
  });

  const getStockStatus = (stock: number, min: number) => {
    if (stock === 0) return { label: 'Agotado', color: 'bg-red-100 text-red-600 border-red-200' };
    if (stock <= min) return { label: 'Bajo Stock', color: 'bg-orange-100 text-orange-600 border-orange-200' };
    return { label: 'Disponible', color: 'bg-green-100 text-green-600 border-green-200' };
  };

  const getTitle = () => {
    switch (currentView) {
      case 'STOCK': return { title: 'Existencias', subtitle: 'Vista general del stock actual y precios.' };
      case 'CATALOG': return { title: editingProduct ? 'Editar Producto' : 'Nuevo Producto', subtitle: editingProduct ? `Editando: ${editingProduct.name}` : 'Ficha técnica y registro maestro.' };
      case 'MOVEMENT': return { title: editingMovementId ? 'Editar Movimiento' : 'Nuevo Movimiento', subtitle: editingMovementId ? `Modificando registro ${editingMovementId}` : 'Registro de Entradas y Salidas.' };
      case 'KARDEX': return { title: 'Kardex Histórico', subtitle: 'Auditoría de movimientos y detalle.' };
      case 'AUDIT': return { title: 'Auditoría de Inventario', subtitle: 'Conteo físico vs Sistema y Ajustes.' };
      default: return { title: 'Inventario', subtitle: '' };
    }
  };

  const headerInfo = getTitle();

  // Metrics Calculation for Mini Scoreboard
  const stockMetrics = {
    count: products.length,
    units: products.reduce((sum, p) => sum + p.stock_level, 0),
    value: products.reduce((sum, p) => sum + (p.stock_level * p.price), 0),
    investment: totalInvestment
  };

  const generateInventoryReport = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();

    // Title
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text("Reporte de Salud y Stock", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`ANECHKA POS SYSTEM - Generado: ${date}`, 14, 26);

    // Summary Metrics based on Filtered Stock
    const itemsCount = filteredStock.length;
    const unitsCount = filteredStock.reduce((sum, p) => sum + p.stock_level, 0);
    const saleValue = filteredStock.reduce((sum, p) => sum + (p.stock_level * p.price), 0);

    // Summary Box
    doc.setDrawColor(220);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, 32, 182, 28, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("ITEMS LISTADOS", 20, 42);
    doc.text("UNIDADES TOTALES", 80, 42);
    doc.text("VALOR VENTA TOTAL", 140, 42);

    doc.setFontSize(16);
    doc.setTextColor(33, 33, 33);
    doc.setFont("helvetica", "bold");
    doc.text(itemsCount.toString(), 20, 52);
    doc.text(unitsCount.toString(), 80, 52);
    doc.setTextColor(40, 167, 69); // Green for money
    doc.text(`$${saleValue.toLocaleString()}`, 140, 52);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);

    // Table Data
    const tableColumn = ["Producto", "SKU", "Marca", "Categoría", "Stock", "Estado", "Precio", "Total"];
    const tableRows = filteredStock.map(p => {
      let status = "OK";
      if (p.stock_level <= 0) status = "AGOTADO";
      else if (p.stock_level <= p.min_stock) status = "BAJO";

      return [
        p.name.substring(0, 35),
        p.sku,
        p.brand,
        p.category_name || '-',
        p.stock_level,
        status,
        `$${p.price.toFixed(2)}`,
        `$${(p.stock_level * p.price).toFixed(2)}`
      ];
    });

    // AutoTable
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 70,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
      headStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 50 }, // Name
        4: { halign: 'center' }, // Stock
        5: { halign: 'center', fontStyle: 'bold' }, // Status
        6: { halign: 'right' }, // Price
        7: { halign: 'right', fontStyle: 'bold' }  // Total
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 5) {
          const status = data.cell.raw;
          if (status === 'AGOTADO') {
            data.cell.styles.textColor = [220, 53, 69]; // Red
          } else if (status === 'BAJO') {
            data.cell.styles.textColor = [255, 140, 0]; // Orange
          } else {
            data.cell.styles.textColor = [40, 167, 69]; // Green
          }
        }
      }
    });

    doc.save(`Inventario_Anechka_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">{headerInfo.title}</h2>
          <p className="text-gray-500">{headerInfo.subtitle}</p>
        </div>

        {/* TOP RIGHT MINI SCOREBOARD (VISIBLE IN STOCK VIEW) */}
        {currentView === 'STOCK' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-4">
            {/* Card 1: Items */}
            <div className="bg-white/40 backdrop-blur-xl p-3 rounded-2xl border border-white/50 shadow-sm flex flex-col justify-center items-center">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Items</span>
              <span className="text-2xl font-black text-gray-800">{stockMetrics.count}</span>
            </div>

            {/* Card 2: Unidades */}
            <div className="bg-white/40 backdrop-blur-xl p-3 rounded-2xl border border-white/50 shadow-sm flex flex-col justify-center items-center">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Unidades</span>
              <span className="text-2xl font-black text-brand-primary">{stockMetrics.units}</span>
            </div>

            {/* Card 3: Inversión */}
            <div className="bg-white/40 backdrop-blur-xl p-3 rounded-2xl border border-white/50 shadow-sm flex flex-col justify-center items-center">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Costo Total</span>
              <span className="text-xl font-black text-blue-600">${stockMetrics.investment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

            {/* Card 4: Valor */}
            <div className="bg-white/40 backdrop-blur-xl p-3 rounded-2xl border border-white/50 shadow-sm flex flex-col justify-center items-center">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Valor Venta</span>
              <span className="text-xl font-black text-emerald-600">${stockMetrics.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        )}
      </header>

      {/* --- VIEW: KARDEX --- */}
      {currentView === 'KARDEX' && (
        <div className="animate-fade-in-up">
          {/* ... (Kardex View Content Omitted for brevity, logic unchanged) ... */}
          <GlassCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider text-xs">
                    <th className="py-3 px-4 min-w-[160px]">Fecha</th>
                    <th className="py-3 px-4 min-w-[100px]">Tipo</th>
                    <th className="py-3 px-4 min-w-[300px] md:min-w-[450px]">Glosa / Razón</th>
                    <th className="py-3 px-4 text-right min-w-[140px]">Impacto Costo</th>
                    <th className="py-3 px-4 text-right min-w-[100px]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => (
                      <tr
                        key={mov.id}
                        className="hover:bg-white/40 transition-colors cursor-pointer text-gray-900 group"
                        onClick={() => handleViewDetails(mov)}
                      >
                        <td className="py-3 px-4 font-mono text-gray-600">
                          {new Date(mov.date).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`
                             px-2 py-1 rounded text-xs font-bold uppercase
                             ${mov.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}
                           `}>
                            {mov.type === 'IN' ? 'Entrada' : 'Salida'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800">
                          {mov.reason}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          ${mov.total_cost_impact.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditMovement(mov);
                              }}
                              title="Editar Movimiento Completo"
                              className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                            >
                              <Icons.Edit />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMovement(mov.id);
                              }}
                              title="Eliminar (Revertir)"
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Icons.Trash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
          {/* ... (Detail Modal Omitted, Logic unchanged) ... */}
        </div>
      )}

      {/* --- VIEW: MOVEMENT (CREATE/EDIT) --- */}
      {currentView === 'MOVEMENT' && (
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in-up">
          {/* ... (Movement Content Omitted for brevity, logic unchanged) ... */}
          {/* I am focusing on the CATALOG (New Product) view for the requested changes */}
          <GlassCard className="lg:w-2/3 space-y-6">
            {/* ... Same content as before ... */}
            <div className="border-b border-gray-200/50 pb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingMovementId ? 'Modificar Movimiento' : 'Cabecera del Movimiento'}
                </h3>
                {editingMovementId && (
                  <button
                    onClick={cancelEdit}
                    className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-gray-700 font-bold"
                  >
                    Cancelar Edición
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Tipo de Movimiento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de Movimiento</label>
                  <div className="relative">
                    <select
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value as MovementType)}
                      disabled={!!editingMovementId}
                      className={`w-full px-4 py-2 pr-10 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm font-medium appearance-none ${editingMovementId ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      <option value="IN">Entrada</option>
                      <option value="OUT">Salida</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <Icons.ChevronDown />
                    </div>
                  </div>
                </div>

                {/* 2. Concepto (Dependiente) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Concepto</label>
                  <div className="relative">
                    <select
                      value={movementConcept}
                      onChange={(e) => setMovementConcept(e.target.value)}
                      className="w-full px-4 py-2 pr-10 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm appearance-none"
                    >
                      <option value="">-- Seleccionar --</option>
                      {MOVEMENT_CONCEPTS[movementType].map(concept => (
                        <option key={concept} value={concept}>{concept}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <Icons.ChevronDown />
                    </div>
                  </div>
                </div>

                {/* 3. Glosa */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Glosa / Referencia</label>
                  <input
                    type="text"
                    placeholder="Ej. Factura F001-23"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Detail Section Logic (Omitted for Brevity - Keeping functionality) */}
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Agregar Detalle {movementType === 'IN' && <span className="text-xs font-normal text-brand-primary ml-2 bg-brand-primary/10 px-2 py-1 rounded">Actualiza Costo y Precio</span>}
              </h3>

              <div className="bg-white/30 p-4 rounded-xl space-y-3">
                {/* Fila de Escaneo y Selección */}
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs text-gray-500 mb-1">Escanear / Buscar SKU</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={movementSku}
                        onChange={e => setMovementSku(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleMovementScan()}
                        placeholder="Código de Barras..."
                        className="flex-1 px-3 py-2 rounded-lg bg-white/80 border-none text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                      />
                      <button
                        onClick={() => setIsScanning(true)}
                        className="px-3 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors shadow-lg shadow-brand-primary/20"
                        title="Escanear con Cámara"
                      >
                        <Icons.Barcode />
                      </button>
                    </div>
                  </div>

                  <div className="flex-[2] w-full relative">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar y Seleccionar Producto</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Escriba nombre del producto..."
                        value={itemSearchTerm}
                        onChange={e => {
                          setItemSearchTerm(e.target.value);
                          setSelectedProductId(''); // Reset selection on type
                          setShowProductResults(true);
                        }}
                        onFocus={() => setShowProductResults(true)}
                        className="w-full px-3 py-2 rounded-lg bg-white/60 border border-gray-200 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                      />

                      {/* AUTOCOMPLETE DROPDOWN */}
                      {showProductResults && !selectedProductId && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setShowProductResults(false)} />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto scrollbar-thin z-30 animate-fade-in-down">
                            {availableProducts
                              .filter(p => !itemSearchTerm || p.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                              .length > 0 ? (
                              availableProducts
                                .filter(p => !itemSearchTerm || p.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                                .map(p => (
                                  <div
                                    key={p.id}
                                    onClick={() => {
                                      setSelectedProductId(p.id);
                                      setItemSearchTerm(p.name);
                                      setShowProductResults(false);
                                    }}
                                    className="px-4 py-2 hover:bg-violet-50 cursor-pointer border-b border-gray-50 last:border-0"
                                  >
                                    <div className="font-bold text-gray-800 text-sm">{p.name}</div>
                                    <div className="flex justify-between items-center text-xs text-gray-400 mt-0.5">
                                      <span>SKU: {p.sku}</span>
                                      <span className={p.stock_level <= p.min_stock ? 'text-red-500 font-bold' : 'text-gray-500'}>Stock: {p.stock_level}</span>
                                    </div>
                                  </div>
                                ))
                            ) : (
                              <div className="p-4 text-center text-gray-400 text-xs italic">
                                No se encontraron productos.
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Detail Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      value={qtyInput}
                      onChange={e => setQtyInput(parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-white/80 border-none text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Costo Unit.</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costInput}
                      onChange={e => setCostInput(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-white/80 border-none text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                    />
                  </div>

                  {movementType === 'IN' && (
                    <div>
                      <label className="block text-xs font-bold text-brand-primary mb-1">Nuevo Precio Venta</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceInputState}
                        onChange={e => setPriceInput(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-white border-2 border-brand-primary/20 focus:border-brand-primary text-sm font-bold text-brand-primary focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleAddItem}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors text-sm font-bold shadow-lg shadow-brand-primary/20 flex items-center gap-2"
                  >
                    <Icons.Plus /> {selectedProductId ? (pendingItems.find(i => i.productId === selectedProductId) ? 'Actualizar Detalle' : 'Agregar al Detalle') : 'Agregar al Detalle'}
                  </button>
                </div>
              </div>
            </div>

            {/* Table Detail (Unchanged) */}
            <div className="mt-4">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2">Producto</th>
                    <th className="py-2 text-center">Cant.</th>
                    <th className="py-2 text-right">Costo</th>
                    {movementType === 'IN' && <th className="py-2 text-right text-brand-primary">Nuevo Precio</th>}
                    <th className="py-2 text-right">Subtotal</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-white/30 text-gray-900">
                      <td className="py-3 font-medium text-black">{item.productName}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-right">${item.unitCost.toFixed(2)}</td>
                      {movementType === 'IN' && (
                        <td className="py-3 text-right font-bold text-brand-primary">
                          {item.newPrice ? `$${item.newPrice.toFixed(2)}` : '-'}
                        </td>
                      )}
                      <td className="py-3 text-right font-mono">${(item.quantity * item.unitCost).toFixed(2)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditItem(idx)}
                            title="Editar (Mover al formulario)"
                            className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded"
                          >
                            <Icons.Edit />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            title="Eliminar"
                            className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pendingItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 italic text-xs">
                        No hay items en el detalle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Summary Card (Unchanged) */}
          <div className="lg:w-1/3">
            <GlassCard className="sticky top-4 bg-white/50 border-white/60">
              {/* ... Summary Content ... */}
              <h3 className="text-lg font-bold text-gray-800 mb-4">Resumen de Impacto</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items Afectados:</span>
                  <span className="font-bold">{pendingItems.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-800 border-t border-gray-200 pt-3">
                  <span>Total Costo:</span>
                  <span>${pendingItems.reduce((acc, i) => acc + (i.quantity * i.unitCost), 0).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleSubmitMovement}
                disabled={loading || pendingItems.length === 0}
                className={`
                     w-full py-3 rounded-xl text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2
                     ${movementType === 'IN' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/30' : 'bg-red-500 hover:bg-red-600 shadow-red-500/30'}
                     disabled:opacity-50 disabled:cursor-not-allowed
                   `}
              >
                {loading ? 'Procesando...' : (
                  <>
                    <Icons.Check /> {editingMovementId ? 'ACTUALIZAR MOVIMIENTO' : (movementType === 'IN' ? 'CONFIRMAR ENTRADA' : 'CONFIRMAR SALIDA')}
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 mt-4 text-center">
                {movementType === 'IN'
                  ? 'Actualizará stock y precios de venta.'
                  : 'Descontará stock del inventario.'}
              </p>
            </GlassCard>
          </div>
        </div>
      )}

      {/* --- VIEW: AUDIT --- */}
      {currentView === 'AUDIT' && (

        <div className="animate-fade-in-up space-y-4">
          {!activeAuditSession ? (
            // --- START SESSION SCREEN ---
            <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
              <GlassCard className="max-w-md w-full p-8 flex flex-col items-center gap-6">
                <div className="p-4 bg-brand-primary/10 rounded-full text-brand-primary">
                  <Icons.Check />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Iniciar Nueva Auditoría</h3>
                  <p className="text-gray-500 text-sm mt-2">
                    Comience un nuevo proceso de conteo físico. Se registrará la fecha y hora de inicio para el reporte final.
                  </p>
                </div>

                <div className="w-full space-y-3">
                  <button
                    onClick={async () => {
                      if (!window.confirm("¿Iniciar nueva sesión de auditoría?")) return;
                      setLoading(true);
                      const res = await auditService.startAuditSession(user.id, 'PARTIAL');
                      if (res.success) {
                        const session = await auditService.getParameterActiveSession();
                        setActiveAuditSession(session);
                        setAuditItems({});
                      }
                      setLoading(false);
                    }}
                    className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg hover:bg-brand-secondary transition-all"
                  >
                    Iniciar Conteo (Parcial)
                  </button>

                  <button
                    onClick={async () => {
                      setLoading(true);
                      const history = await auditService.getAuditHistory();
                      setAuditHistory(history);
                      setShowAuditHistory(true);
                      setLoading(false);
                    }}
                    className="w-full py-3 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    Ver Historial de Auditorías
                  </button>
                </div>

                {showAuditHistory && (
                  <div className="w-full mt-4 bg-white p-4 rounded-xl shadow-inner max-h-60 overflow-y-auto">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-gray-700 text-sm">Historial Reciente</h4>
                      <button onClick={() => setShowAuditHistory(false)} className="text-xs text-gray-500 hover:text-red-500"><Icons.X /></button>
                    </div>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="py-2">Fecha</th>
                          <th className="py-2">Tipo</th>
                          <th className="py-2 text-right">Diferencia Neta</th>
                          <th className="py-2 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditHistory.map(session => (
                          <tr key={session.id} className="border-b border-gray-100 last:border-0">
                            <td className="py-2">{new Date(session.start_date).toLocaleDateString()}</td>
                            <td className="py-2">{session.type}</td>
                            <td className={`py-2 text-right font-bold ${session.summary_net_variance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {session.summary_net_variance.toFixed(2)}
                            </td>
                            <td className="py-2 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${session.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600'}`}>
                                {session.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* History can be added here later */}
              </GlassCard>
            </div>
          ) : (
            // --- ACTIVE SESSION SCREEN ---
            <>
              {/* Session Header */}
              <div className="bg-orange-50 border border-orange-200 text-orange-900 p-4 rounded-xl flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-orange-100">
                    <Icons.Lock />
                  </div>
                  <div>
                    <span className="font-bold block text-sm">Auditoría en Progreso (ID: ...{activeAuditSession.id.slice(-4)})</span>
                    <span className="text-xs text-orange-700">Iniciada: {new Date(activeAuditSession.start_date).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm("¿Cancelar Auditoría Actual? Se perderán los conteos ingresados.")) {
                      // In a real app we would call cancelAuditSession
                      setActiveAuditSession(null);
                      setAuditItems({});
                    }
                  }}
                  className="text-xs bg-white border border-gray-200 text-red-600 font-bold px-3 py-1.5 rounded hover:bg-red-50"
                >
                  Cancelar
                </button>
              </div>

              {/* Control Bar */}
              <GlassCard className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar item en auditoría..."
                      value={auditSearchTerm}
                      onChange={e => setAuditSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/60 border border-gray-200 focus:ring-2 focus:ring-brand-primary outline-none"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Icons.Search />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditFilter('ALL')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${auditFilter === 'ALL' ? 'bg-brand-primary text-white' : 'bg-white/50 hover:bg-white text-gray-600'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setAuditFilter('DIFF')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${auditFilter === 'DIFF' ? 'bg-orange-500 text-white' : 'bg-white/50 hover:bg-white text-gray-600'}`}
                  >
                    Con Diferencias
                  </button>
                </div>

                <button
                  onClick={() => setIsScanning(true)}
                  className="px-4 py-2 bg-brand-primary text-white rounded-lg flex items-center gap-2 hover:bg-brand-secondary shadow-lg shadow-brand-primary/20"
                >
                  <Icons.Barcode /> Escanear para Contar
                </button>
              </GlassCard>

              {/* Audit Table */}
              <GlassCard className="p-0 overflow-hidden bg-white/70">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="bg-white/50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4 text-center">Stock Sistema</th>
                        <th className="py-3 px-4 text-center w-32">Conteo Físico</th>
                        <th className="py-3 px-4 text-right">Diferencia</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.filter(p => {
                        const matchSearch = p.name.toLowerCase().includes(auditSearchTerm.toLowerCase()) || p.sku.includes(auditSearchTerm);
                        if (!matchSearch) return false;
                        if (auditFilter === 'DIFF') {
                          // If simple audit, maybe init with 0. 
                          return (auditItems[p.id] ?? p.stock_level) !== p.stock_level;
                        }
                        return true;
                      }).map(p => {
                        const physical = auditItems[p.id] ?? p.stock_level; // Defaulting to system stock for "No Change" initial state
                        const diff = physical - p.stock_level;

                        return (
                          <tr key={p.id} className={`hover:bg-white/50 transition-colors ${diff !== 0 ? 'bg-orange-50/50' : ''}`}>
                            <td className="py-3 px-4">
                              <div className="font-bold text-gray-800">{p.name}</div>
                              <div className="text-xs text-gray-500 font-mono">{p.sku}</div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-gray-600">
                              {p.stock_level}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setAuditItems(prev => ({ ...prev, [p.id]: (prev[p.id] ?? p.stock_level) - 1 }))}
                                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-600"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={auditItems[p.id] ?? ''}
                                  placeholder={p.stock_level.toString()}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                    if (val === undefined) {
                                      const newItems = { ...auditItems };
                                      delete newItems[p.id];
                                      setAuditItems(newItems);
                                    } else {
                                      setAuditItems(prev => ({ ...prev, [p.id]: val }));
                                    }
                                  }}
                                  className={`w-16 text-center font-bold bg-white border rounded py-1 focus:ring-2 focus:ring-brand-primary outline-none ${diff !== 0 ? 'text-orange-600 border-orange-200' : 'text-gray-800 border-gray-200'}`}
                                />
                                <button
                                  onClick={() => setAuditItems(prev => ({ ...prev, [p.id]: (prev[p.id] ?? p.stock_level) + 1 }))}
                                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-600"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold">
                              {diff === 0 ? (
                                <span className="text-green-500">-</span>
                              ) : (
                                <span className={diff > 0 ? 'text-green-600' : 'text-red-500'}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {diff !== 0 && (
                                <button
                                  className="text-xs bg-brand-primary text-white px-2 py-1 rounded hover:bg-brand-secondary shadow-sm"
                                  onClick={async () => {
                                    if (window.confirm(`¿Ajustar stock de ${p.name}?\nSistema: ${p.stock_level} -> Físico: ${physical}\nDif: ${diff}`)) {
                                      const type = diff > 0 ? 'IN' : 'OUT';
                                      const qty = Math.abs(diff);
                                      const cost = await inventoryService.getLastProductCost(p.id);

                                      // Pass active session ID !!
                                      const result = await inventoryService.createMovement(
                                        user.id,
                                        type,
                                        `[AUDITORIA-RAPIDA] Ajuste individual ${p.sku}`,
                                        [{ productId: p.id, quantity: qty, unitCost: cost }],
                                        activeAuditSession.id
                                      );

                                      if (result.success) {
                                        refreshData();
                                        const newItems = { ...auditItems };
                                        delete newItems[p.id];
                                        setAuditItems(newItems);
                                      }
                                    }
                                  }}
                                >
                                  Ajustar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              <div className="flex justify-end p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-white/60 sticky bottom-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Items contados: <span className="font-bold text-gray-800">{Object.keys(auditItems).length}</span></p>
                  <button
                    onClick={async () => {
                      const itemsToAdjust = Object.entries(auditItems).map(([pid, physical]) => {
                        const prod = products.find(p => p.id === pid);
                        if (!prod) return null;
                        const diff = (physical as number) - prod.stock_level;
                        if (diff === 0) return null;
                        return { prod, diff, physical };
                      }).filter(Boolean) as { prod: Product, diff: number, physical: number }[];

                      if (itemsToAdjust.length === 0 && Object.keys(auditItems).length === 0) {
                        alert("No ha realizado conteo.");
                        return;
                      }

                      if (window.confirm(`¿Finalizar Auditoría y Procesar ${itemsToAdjust.length} ajustes?\nEsta acción cerrará la sesión de auditoría.`)) {
                        setLoading(true);
                        try {
                          // 1. Calculate Summary for Session
                          let totalSystemVal = 0;
                          let totalPhysicalVal = 0;
                          // Calculate roughly for adjusted items only for this MVP
                          // In a real app we'd iterate all products or at least all products in scope

                          // To be more correct, let's grab costs for adjusted items
                          // BUT for the CLOSING summary payload, we need values.
                          // Let's do movements first, then sum up their value.

                          const surpluses = itemsToAdjust.filter(i => i.diff > 0);
                          const deficits = itemsToAdjust.filter(i => i.diff < 0);

                          let netVariance = 0;

                          // Process Surplus
                          if (surpluses.length > 0) {
                            const items = await Promise.all(surpluses.map(async s => {
                              const cost = await inventoryService.getLastProductCost(s.prod.id);
                              netVariance += (s.diff * cost);
                              return {
                                productId: s.prod.id,
                                quantity: s.diff,
                                unitCost: cost
                              };
                            }));

                            await inventoryService.createMovement(
                              user.id,
                              'IN',
                              `[AUDIT-SESSION-${activeAuditSession.id.slice(0, 8)}] Ajuste Sobrante`,
                              items,
                              activeAuditSession.id
                            );
                          }

                          // Process Deficits
                          if (deficits.length > 0) {
                            const items = await Promise.all(deficits.map(async s => {
                              const cost = await inventoryService.getLastProductCost(s.prod.id);
                              netVariance -= (Math.abs(s.diff) * cost); // Loss
                              return {
                                productId: s.prod.id,
                                quantity: Math.abs(s.diff),
                                unitCost: cost
                              };
                            }));

                            await inventoryService.createMovement(
                              user.id,
                              'OUT',
                              `[AUDIT-SESSION-${activeAuditSession.id.slice(0, 8)}] Ajuste Faltante`,
                              items,
                              activeAuditSession.id
                            );
                          }

                          // 2. Close Session
                          await auditService.closeAuditSession(activeAuditSession.id, {
                            systemVal: 0, // Pending full calc
                            physicalVal: 0, // Pending full calc
                            netVariance: netVariance
                          });

                          alert(`Auditoria Finalizada.\nDiferencia Neta: $${netVariance.toFixed(2)}`);
                          setAuditItems({});
                          setActiveAuditSession(null); // Return to Start screen
                          refreshData();
                        } catch (e) {
                          console.error(e);
                          alert("Error procesando cierre de auditoría.");
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    className="bg-gray-800 hover:bg-black text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-gray-900/20 transition-all flex items-center gap-2"
                  >
                    <Icons.Check /> Finalizar y Cerrar Auditoría
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- VIEW: STOCK --- */}
      {currentView === 'STOCK' && (
        <div className="animate-fade-in-up space-y-4">
          {/* ... Stock view content unchanged ... */}
          {/* SEARCH & FILTERS BAR */}
          <GlassCard className="py-3 px-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-white/40">
            <div className="relative flex-1 w-full md:max-w-md">
              <input
                type="text"
                placeholder="Buscar por Nombre, SKU, Marca o Categoría..."
                value={stockSearchTerm}
                onChange={(e) => setStockSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/70 border border-white/50 focus:ring-2 focus:ring-brand-primary outline-none text-sm"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icons.Search />
              </div>
            </div>
            <div className="flex gap-2 text-xs font-bold text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Disp.</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Bajo</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Agotado</span>
            </div>

            <button
              onClick={generateInventoryReport}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-2 whitespace-nowrap"
              title="Descargar Reporte PDF"
            >
              <Icons.FileText /> PDF Reporte
            </button>
          </GlassCard>

          {/* DATA TABLE CARD */}
          <GlassCard className="p-0 overflow-hidden bg-white/70 border-white/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    <th className="py-3 px-4 w-12"></th>
                    <th className="py-3 px-4 min-w-[200px]">Producto / SKU</th>
                    <th className="py-3 px-4 min-w-[120px]">Marca</th>
                    <th className="py-3 px-4 min-w-[80px]">Talla</th>
                    <th className="py-3 px-4 min-w-[120px]">Categoría</th>
                    <th className="py-3 px-4 text-center min-w-[120px]">Estado Stock</th>
                    <th className="py-3 px-4 text-right min-w-[100px]">Precio Venta</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 italic">
                        No se encontraron productos que coincidan con "{stockSearchTerm}".
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map(product => {
                      const status = getStockStatus(product.stock_level, product.min_stock);
                      return (
                        <tr
                          key={product.id}
                          onClick={() => setViewingProduct(product)}
                          className="hover:bg-brand-primary/5 transition-colors group cursor-pointer"
                        >
                          <td className="py-3 px-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                              <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-800">{product.name}</div>
                            <div className="text-xs text-gray-500 font-mono">{product.sku}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-600 font-medium">{product.brand}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-800 font-bold text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">{product.size || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
                              {product.category_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${status.color}`}>
                                {product.stock_level} Uds.
                              </span>
                              {product.stock_level <= product.min_stock && (
                                <span className="text-[10px] text-red-500 font-bold mt-1">Min: {product.min_stock}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-gray-700">
                            ${product.price.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProductClick(product);
                              }}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                              title="Editar Producto"
                            >
                              <Icons.Edit />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Modal Detail Omitted (Unchanged) */}
          {viewingProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setViewingProduct(null)}>
              {/* ... Modal content ... */}
              <GlassCard className="w-full max-w-lg bg-white/95 border-white shadow-2xl overflow-hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div className="relative h-48 bg-gray-100">
                  <img src={viewingProduct.image_url} alt={viewingProduct.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setViewingProduct(null)}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                  >
                    <Icons.X />
                  </button>
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-2xl font-bold text-white drop-shadow-md">{viewingProduct.name}</h3>
                    <span className="text-white/90 text-sm font-mono bg-black/30 px-2 py-1 rounded">{viewingProduct.sku}</span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* ... Details ... */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">Marca</span>
                      <span className="font-bold text-gray-800">{viewingProduct.brand}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">Categoría</span>
                      <span className="font-bold text-gray-800">{viewingProduct.category_name}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">Color</span>
                      <span className="font-bold text-gray-800">{viewingProduct.color || 'N/A'}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">Género</span>
                      <span className="font-bold text-gray-800">{viewingProduct.gender || 'N/A'}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">Talla</span>
                      <span className="font-bold text-gray-800">{viewingProduct.size || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        setViewingProduct(null);
                        handleEditProductClick(viewingProduct);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors text-sm font-bold"
                    >
                      <Icons.Edit /> Editar Ficha
                    </button>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {/* --- VIEW: CATALOG (NEW / EDIT PRODUCT) --- */}
      {currentView === 'CATALOG' && (
        <div className="animate-fade-in-up flex justify-center">
          <GlassCard className="w-full max-w-4xl bg-white/50 border-white/60">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200/50">
              <h3 className="text-xl font-bold text-gray-800">
                {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
              </h3>
              {editingProduct && (
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setNewProduct(INITIAL_PRODUCT_FORM);
                    setCurrentView('STOCK');
                  }}
                  className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-gray-700 font-bold"
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            <form onSubmit={handleRegisterProduct} className="space-y-6">

              {/* --- SECCIÓN 1: IDENTIFICACIÓN PRINCIPAL --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SKU */}
                <div className="relative md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Sku / Código De Barras {editingProduct ? '(Bloqueado)' : '*'}</label>
                  <div className="flex gap-2 relative">
                    {editingProduct && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                        <Icons.Lock />
                      </div>
                    )}
                    <input
                      type="text"
                      name="sku"
                      value={newProduct.sku}
                      onChange={handleProductChange}
                      placeholder="Escanee o escriba..."
                      required
                      disabled={!!editingProduct}
                      className={`
                             flex-1 px-4 py-2 rounded-lg border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm transition-all
                             ${editingProduct ? 'pl-10 bg-gray-200 text-gray-600 cursor-not-allowed border-gray-300' : 'bg-white/60'}
                          `}
                      autoFocus={!editingProduct} // Only autofocus on create
                    />
                    {!editingProduct && (
                      <button
                        type="button"
                        onClick={() => setIsScanning(true)}
                        className="px-4 bg-brand-primary rounded-lg text-white hover:bg-brand-secondary transition-colors flex items-center justify-center shadow-lg shadow-brand-primary/20"
                        title="Escanear con Cámara"
                      >
                        <Icons.Barcode />
                      </button>
                    )}
                  </div>
                  {editingProduct && <p className="text-[10px] text-red-500 mt-1">* El SKU no se puede editar para mantener la consistencia histórica. Si es erróneo, cree un nuevo producto.</p>}
                </div>

                {/* Nombre */}
                <div className="md:col-span-2">
                  <FormInput label="Nombre Del Producto" name="name" value={newProduct.name} onChange={handleProductChange} placeholder="Ej. Pantalón Denim" required />
                </div>

                {/* Categoría y Marca */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Categoría *</label>
                  <div className="relative">
                    <select
                      name="category_id"
                      value={newProduct.category_id}
                      onChange={handleProductChange}
                      required
                      className="w-full px-4 py-2 pr-10 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm appearance-none"
                    >
                      <option value="">-- Seleccionar --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <Icons.ChevronDown />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Marca *</label>
                  <div className="relative">
                    <select
                      name="brand_id" // Use brand_id for value
                      value={newProduct.brand_id}
                      onChange={handleBrandChange} // Custom handler
                      required
                      className="w-full px-4 py-2 pr-10 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm appearance-none"
                    >
                      <option value="">-- Seleccionar --</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <Icons.ChevronDown />
                    </div>
                  </div>
                  {/* Fallback Display or Hidden Input for Legacy Text (auto-filled) */}
                  <input type="hidden" name="brand" value={newProduct.brand} />
                </div>
              </div>

              {/* --- SECCIÓN 2: ATRIBUTOS --- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/20 p-4 rounded-xl border border-white/30">
                <div>
                  <FormInput label="Color" name="color" value={newProduct.color} onChange={handleProductChange} placeholder="Ej. Azul" />
                </div>

                <div>
                  <FormInput label="Talla" name="size" value={newProduct.size || ''} onChange={handleProductChange} placeholder="Ej. M, 42, Única" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Género / Sexo</label>
                  <div className="relative">
                    <select name="gender" value={newProduct.gender} onChange={handleProductChange} className="w-full px-4 py-2 pr-10 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm appearance-none">
                      <option value="UNISEX">Unisex</option>
                      <option value="HOMBRE">Hombre</option>
                      <option value="MUJER">Mujer</option>
                      <option value="NIÑA">Niña</option>
                      <option value="NIÑO">Niño</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <Icons.ChevronDown />
                    </div>
                  </div>
                </div>

                <div>
                  <FormInput label="Stock Mínimo (Alerta)" name="min_stock" type="number" value={newProduct.min_stock} onChange={handleProductChange} />
                </div>
              </div>

              {/* --- SECCIÓN 3: DESCRIPCIÓN --- */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descripción Detallada</label>
                <textarea
                  name="description"
                  value={newProduct.description}
                  onChange={handleProductChange}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm resize-none"
                  placeholder="Características, material, cuidados..."
                />
              </div>

              {/* --- SECCIÓN 4: IMAGEN --- */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Imagen Del Producto</label>

                {newProduct.image_url ? (
                  // PREVIEW STATE: Show large image with "Remove" action
                  <div className="relative h-48 w-full rounded-xl border border-gray-300 bg-white overflow-hidden group">
                    <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setNewProduct(prev => ({ ...prev, image_url: '' }))}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors flex items-center gap-2"
                      >
                        <Icons.Trash /> Eliminar Imagen
                      </button>
                    </div>
                  </div>
                ) : (
                  // EMPTY STATE: 50/50 Split Buttons
                  <div className="grid grid-cols-2 gap-4 h-32">
                    {/* Button 1: File Upload */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-100 transition-all flex flex-col items-center justify-center gap-2 text-blue-600 group active:scale-95"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="p-3 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                        <Icons.Upload />
                      </div>
                      <div className="text-center">
                        <span className="block text-sm font-bold">Subir Imagen</span>
                        <span className="block text-[10px] opacity-70">Desde Galería</span>
                      </div>
                    </div>

                    {/* Button 2: Camera Capture */}
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="cursor-pointer rounded-xl border-2 border-dashed border-brand-primary/30 bg-brand-primary/5 hover:bg-brand-primary/10 transition-all flex flex-col items-center justify-center gap-2 text-brand-primary group active:scale-95"
                    >
                      <div className="p-3 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                        <Icons.Camera />
                      </div>
                      <div className="text-center">
                        <span className="block text-sm font-bold">Tomar Foto</span>
                        <span className="block text-[10px] opacity-70">Usar Cámara</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200/30">
                <button
                  type="button"
                  onClick={() => {
                    setNewProduct(INITIAL_PRODUCT_FORM);
                    setEditingProduct(null);
                  }}
                  className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white/50 transition-colors text-sm font-medium"
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 rounded-lg bg-brand-primary text-white font-bold hover:bg-brand-secondary shadow-lg shadow-brand-primary/30 transition-all transform hover:-translate-y-0.5 text-sm flex items-center gap-2"
                >
                  {loading ? 'Guardando...' : (
                    <>
                      <Icons.Check /> {editingProduct ? 'Actualizar Ficha' : 'Registrar Ficha'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* SCANNER MODAL (BARCODE) */}
      <ScannerModal
        isOpen={isScanning}
        onClose={() => setIsScanning(false)}
        onScan={handleScanSuccess}
        title="Escáner Inventario"
      />

      {/* PHOTO CAMERA MODAL (PRODUCT IMAGE) */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black animate-fade-in">
          <div className="w-full h-full relative flex flex-col">

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
              <span className="text-white font-bold">Tomar Foto Producto</span>
              <button
                onClick={handleCloseCamera}
                className="bg-black/40 text-white p-2 rounded-full backdrop-blur-md"
              >
                <Icons.X />
              </button>
            </div>

            {/* Video Feed */}
            <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent z-20">
              <button
                onClick={handleCapturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/40 transition-all active:scale-95 shadow-lg shadow-black/50"
                title="Capturar"
              >
                <div className="w-16 h-16 bg-white rounded-full"></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FormInput = ({ label, name, value, onChange, type = "text", placeholder, required = false, step }: any) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1">{label} {required && '*'}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      step={step}
      className="w-full px-4 py-2 rounded-lg bg-white/60 border border-white/40 focus:ring-2 focus:ring-brand-primary outline-none text-sm transition-all"
    />
  </div>
);
