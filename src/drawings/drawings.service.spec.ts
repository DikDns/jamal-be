import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DrawingsService } from './drawings.service';
import { Drawing } from './drawing.entity';

describe('DrawingsService', () => {
    let service: DrawingsService;
    let repository: Repository<Drawing>;

    // Mock repository - ini adalah tiruan dari TypeORM Repository
    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOneBy: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    // Setup testing module sebelum setiap test
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DrawingsService,
                {
                    provide: getRepositoryToken(Drawing),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<DrawingsService>(DrawingsService);
        repository = module.get<Repository<Drawing>>(getRepositoryToken(Drawing));

        // Reset semua mock sebelum test baru dimulai
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ========================================
    // BE-TC-1: Get All Drawings
    // ========================================
    describe('findAll', () => {
        it('should return an array of drawings', async () => {
            const mockDrawings = [
                { id: '1', name: 'Drawing 1', created_at: new Date(), updated_at: new Date() },
                { id: '2', name: 'Drawing 2', created_at: new Date(), updated_at: new Date() },
            ];
            mockRepository.find.mockResolvedValue(mockDrawings);

            const result = await service.findAll();

            expect(mockRepository.find).toHaveBeenCalledWith({
                select: ['id', 'name', 'created_at', 'updated_at'],
            });
            expect(result).toEqual(mockDrawings);
            expect(result).toHaveLength(2);
        });

        it('should return an empty array when no drawings exist', async () => {
            mockRepository.find.mockResolvedValue([]);

            const result = await service.findAll();

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });
    });

    // ========================================
    // BE-TC-2: Get Drawing by ID
    // ========================================
    describe('findOne', () => {
        it('should return a drawing when ID exists', async () => {
            const drawingId = '123e4567-e89b-12d3-a456-426614174000';
            const mockDrawing = {
                id: drawingId,
                name: 'My Drawing',
                store: { data: 'test' },
                created_at: new Date(),
                updated_at: new Date(),
            };
            mockRepository.findOneBy.mockResolvedValue(mockDrawing);

            const result = await service.findOne(drawingId);

            expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: drawingId });
            expect(result).toEqual(mockDrawing);
        });

        it('should return null when ID does not exist', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            const result = await service.findOne('non-existent-id');

            expect(result).toBeNull();
        });
    });

    // ========================================
    // BE-TC-3: Create Drawing Valid
    // ========================================
    describe('create', () => {
        it('should create a new drawing with valid data', async () => {
            const payload = { name: 'New Drawing', store: { data: 'test' } };
            const mockCreatedDrawing = {
                id: '123',
                ...payload,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockRepository.create.mockReturnValue(mockCreatedDrawing);
            mockRepository.save.mockResolvedValue(mockCreatedDrawing);

            const result = await service.create(payload);

            expect(mockRepository.create).toHaveBeenCalledWith({
                name: payload.name,
                store: payload.store,
            });
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toEqual(mockCreatedDrawing);
            expect(result).toHaveProperty('id');
        });

        it('should create a drawing without name', async () => {
            const payload = { store: { data: 'test' } };
            const mockCreatedDrawing = {
                id: '456',
                store: payload.store,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockRepository.create.mockReturnValue(mockCreatedDrawing);
            mockRepository.save.mockResolvedValue(mockCreatedDrawing);

            const result = await service.create(payload);

            expect(result).toHaveProperty('id');
            expect(result.store).toEqual(payload.store);
        });

        it('should throw error when store is missing', async () => {
            const invalidPayload = { name: 'No Store' } as any;

            try {
                await service.create(invalidPayload);
                // Jika tidak throw error, fail test
                fail('Expected BadRequestException to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                expect(error.message).toBe('store is required');
            }
        });
    });

    // ========================================
    // BE-TC-4: Update Drawing Valid
    // ========================================
    describe('update', () => {
        it('should update a drawing when ID exists', async () => {
            // ===== ARRANGE =====
            const drawingId = '123e4567-e89b-12d3-a456-426614174000';
            const updatePayload = { name: 'Updated Drawing', store: { data: 'updated' } };

            // Drawing yang sudah ada
            const existingDrawing = {
                id: drawingId,
                name: 'Old Name',
                store: { data: 'old' },
                created_at: new Date(),
                updated_at: new Date(),
            };

            // Drawing setelah diupdate
            const updatedDrawing = {
                ...existingDrawing,
                ...updatePayload,
                updated_at: new Date(),
            };

            // Mock behavior:
            // 1. Pertama findOneBy dipanggil untuk cek apakah drawing exists
            // 2. Kemudian update dipanggil
            // 3. Kemudian findOneBy dipanggil lagi untuk return drawing yang sudah diupdate
            mockRepository.findOneBy
                .mockResolvedValueOnce(existingDrawing)  // untuk cek exists
                .mockResolvedValueOnce(updatedDrawing);  // untuk return result
            mockRepository.update.mockResolvedValue({ affected: 1 });

            // ===== ACT =====
            const result = await service.update(drawingId, updatePayload);

            // ===== ASSERT =====
            expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: drawingId });
            expect(mockRepository.update).toHaveBeenCalledWith(drawingId, updatePayload);
            expect(result).toEqual(updatedDrawing);
            expect(result!.name).toBe('Updated Drawing');
        });

        it('should update only name field', async () => {
            const drawingId = '123';
            const updatePayload = { name: 'New Name Only' };

            const existingDrawing = {
                id: drawingId,
                name: 'Old Name',
                store: { data: 'test' },
                created_at: new Date(),
                updated_at: new Date(),
            };

            const updatedDrawing = { ...existingDrawing, name: 'New Name Only' };

            mockRepository.findOneBy
                .mockResolvedValueOnce(existingDrawing)
                .mockResolvedValueOnce(updatedDrawing);
            mockRepository.update.mockResolvedValue({ affected: 1 });

            const result = await service.update(drawingId, updatePayload);

            expect(mockRepository.update).toHaveBeenCalledWith(drawingId, { name: 'New Name Only' });
            expect(result!.name).toBe('New Name Only');
        });

        it('should throw NotFoundException when drawing does not exist', async () => {
            const nonExistentId = 'non-existent-id';
            const updatePayload = { name: 'Updated' };

            // Mock findOneBy return null (drawing tidak ditemukan)
            mockRepository.findOneBy.mockResolvedValue(null);

            try {
                await service.update(nonExistentId, updatePayload);
                fail('Expected NotFoundException to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe(`Drawing ${nonExistentId} not found`);
            }

            // Pastikan update TIDAK dipanggil karena drawing tidak ditemukan
            expect(mockRepository.update).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // BE-TC-5: Delete Drawing Valid
    // ========================================
    describe('remove', () => {
        it('should delete a drawing when ID exists', async () => {
            // ===== ARRANGE =====
            const drawingId = '123e4567-e89b-12d3-a456-426614174000';
            const existingDrawing = {
                id: drawingId,
                name: 'Drawing to Delete',
                store: { data: 'test' },
                created_at: new Date(),
                updated_at: new Date(),
            };

            // Mock behavior: findOneBy menemukan drawing, lalu remove menghapusnya
            mockRepository.findOneBy.mockResolvedValue(existingDrawing);
            mockRepository.remove.mockResolvedValue(existingDrawing);

            // ===== ACT =====
            const result = await service.remove(drawingId);

            // ===== ASSERT =====
            // Verifikasi findOneBy dipanggil untuk cek apakah drawing ada
            expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: drawingId });

            // Verifikasi remove dipanggil dengan drawing entity
            expect(mockRepository.remove).toHaveBeenCalledWith(existingDrawing);

            // Verifikasi hasil yg dikembalikan adalah drawing yang dihapus
            expect(result).toEqual(existingDrawing);
        });

        it('should throw NotFoundException when drawing does not exist', async () => {
            // ===== ARRANGE =====
            const nonExistentId = 'non-existent-id';

            // Mock findOneBy return null (drawing tidak ditemukan)
            mockRepository.findOneBy.mockResolvedValue(null);

            // ===== ACT & ASSERT =====
            try {
                await service.remove(nonExistentId);
                fail('Expected NotFoundException to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe(`Drawing ${nonExistentId} not found`);
            }

            // Pastikan remove TIDAK dipanggil karena drawing tidak ditemukan
            expect(mockRepository.remove).not.toHaveBeenCalled();
        });
    });
});
