export interface GoodsReturnRepository {
  findById(id: string): Promise<any>;
  save(entity: any): Promise<void>;
}
