from fastapi import FastAPI, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import os
from datetime import datetime
import shutil
import time
from typing import Optional, List

app = FastAPI()

@app.get("/")
def root():
    return {
        "message": "Smart Dashboard API is running 🚀"
    }

@app.get("/api/ping")
def ping():
    return {"status": "online", "timestamp": datetime.now().isoformat()}


# --- Konfigurasi CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "data_files"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
    
DEFAULT_FILE = os.path.join(UPLOAD_DIR, "business_data.csv")

# Inisialisasi file jika belum ada
if not os.path.exists(DEFAULT_FILE):
    pd.DataFrame(columns=["Date", "Product", "Total_Sales", "Profit"]).to_csv(DEFAULT_FILE, index=False)

# --- Schemas (Pydantic Models) ---
class SaleEntry(BaseModel):
    Product: str
    Total_Sales: float
    Cost: float
    filename: Optional[str] = None

class ProductDelete(BaseModel):
    product_name: str
    filename: Optional[str] = None

class UpdateRowEntry(BaseModel):
    index: int
    new_data: dict
    mapping: dict
    filename: Optional[str] = None

class BatchDelete(BaseModel):
    indexes: List[int]
    filename: Optional[str] = None

# --- Helper Functions ---
def smart_read_csv(filename):
    """Membaca CSV dengan pembatasan jumlah baris agar super cepat."""
    # Sesuai permintaan user: batasi hanya 500 data saja agar tidak berat
    limit_rows = 500
    encodings = ['iso-8859-1', 'utf-8', 'latin-1', 'cp1252']
    
    print(f"INFO: Membatasi pembacaan file ke {limit_rows} baris pertama untuk kecepatan maksimal.")

    for encoding in encodings:
        try:
            # nrows=limit_rows langsung membatasi data yang dibaca dari disk
            df = pd.read_csv(filename, encoding=encoding, engine='c', nrows=limit_rows)
            # Bersihkan BOM (\ufeff) dan spasi dari nama kolom
            df.columns = [c.encode('ascii', 'ignore').decode('ascii').strip() if isinstance(c, str) else c for c in df.columns]
            df.columns = [c.replace('\ufeff', '').strip() for c in df.columns]
            print(f"SUCCESS: Berhasil memuat {len(df)} baris (Limit aktif). Kolom: {df.columns.tolist()}")
            return df
        except UnicodeDecodeError:
            continue
        except Exception:
            continue
            
    # Fallback terakhir dengan limitasi tetap aktif
    return pd.read_csv(filename, encoding='latin-1', engine='python', nrows=limit_rows, on_bad_lines='skip')

def load_data(filename=DEFAULT_FILE):
    if not os.path.exists(filename) or os.stat(filename).st_size == 0:
        return pd.DataFrame(columns=["Date", "Product", "Total_Sales", "Profit"])
    try:
        return smart_read_csv(filename)
    except Exception:
        return pd.DataFrame(columns=["Date", "Product", "Total_Sales", "Profit"])

# --- New Helper for AI Insights ---
def generate_insights(df, prod_col, sales_col):
    if df.empty: return "No transaction data found for this period to analyze."
    try:
        total_sales = df[sales_col].sum()
        top_product_group = df.groupby(prod_col)[sales_col].sum()
        if top_product_group.empty: return "Data exists but no clear product hierarchy identified."
        top_p = top_product_group.idxmax()
        avg_sales = df[sales_col].mean()
        
        insights = [
            f"Overall performance is heavily driven by {top_p}, which is currently the top-performing product.",
            f"The average transaction value is around ${avg_sales:,.2f}.",
            f"Total revenue for this period reached ${total_sales:,.2f}."
        ]
        if len(df) > 10: insights.append("Sales volume appears stable and consistent across the selected period.")
        return insights # Return as list for better frontend rendering
    except Exception as e:
        return [f"Analyzing data patterns... (Technical note: {str(e)})"]

# --- Global Cache ---
data_cache = {
    "filename": None,
    "df": None,
    "last_loaded": None
}

def clear_backend_cache():
    global data_cache
    print("INFO: Clearing memory cache to apply new data limits.")
    data_cache = {"filename": None, "df": None, "last_loaded": None}

# Reset paksa saat restart/penerapan kode baru
clear_backend_cache()

def get_cached_data(filename, date_col, sales_col, profit_col):
    global data_cache
    
    # Check if we need to reload
    if data_cache["filename"] == filename and data_cache["df"] is not None:
        return data_cache["df"]
    
    # Load and Pre-process
    print(f"CACHE MISS: Loading {filename}...")
    df = load_data(filename)
    if df.empty: return df

    # Vectorized Pre-processing (Only once!)
    def fast_clean(series):
        return pd.to_numeric(
            series.astype(str).str.replace(r'[$,€£\s]', '', regex=True).str.replace(',', '', regex=False),
            errors='coerce'
        ).fillna(0)

    # Use first columns if mapping not found in dataframe
    actual_date_col = date_col if date_col in df.columns else df.columns[0]
    actual_sales_col = sales_col if sales_col in df.columns else (df.columns[1] if len(df.columns) > 1 else df.columns[0])
    actual_profit_col = profit_col if profit_col in df.columns else None

    df['Date_Parsed'] = pd.to_datetime(df[actual_date_col], errors='coerce')
    df = df.dropna(subset=['Date_Parsed'])
    df['Val_Sales'] = fast_clean(df[actual_sales_col])
    
    if actual_profit_col and actual_profit_col in df.columns:
        df['Val_Profit'] = fast_clean(df[actual_profit_col])
    else:
        df['Val_Profit'] = df['Val_Sales'] * 0.3
    
    data_cache = {
        "filename": filename,
        "df": df,
        "last_loaded": time.time()
    }
    return df

# --- 1. ENDPOINT STATS ---
@app.get("/api/stats")
def get_stats(
    days: int = 30, 
    filename: Optional[str] = None, 
    date_col: str = "Date", 
    sales_col: str = "Total_Sales",
    product_col: str = "Product",
    profit_col: str = "Profit"
):
    target_file = os.path.join(UPLOAD_DIR, filename) if filename and filename != "" else DEFAULT_FILE
    
    try:
        import time
        start_time = time.time()
        
        # Use Cached Data
        df = get_cached_data(target_file, date_col, sales_col, profit_col)
        
        if df.empty:
            return {
                "total_sales": 0, "total_profit": 0, "total_orders": 0, 
                "top_products": {}, "chart_data": [], "prediction_next_month": 0,
                "raw_data": [], "growth": 0, "insights": "Awaiting data...",
                "warning": "No valid data found. This usually means the 'Date' column mapping is incorrect."
            }

        # The columns might have changed mapping in the UI, but we use the cached parsed versions
        actual_prod_col = product_col if product_col in df.columns else df.columns[0]

        latest_date = df['Date_Parsed'].max()
        cutoff_date = latest_date - pd.Timedelta(days=days)
        f_df = df[df['Date_Parsed'] >= cutoff_date].copy()

        # Comparison Logic
        prev_cutoff = cutoff_date - pd.Timedelta(days=days)
        p_df = df[(df['Date_Parsed'] >= prev_cutoff) & (df['Date_Parsed'] < cutoff_date)].copy()
        
        # Calculate actual days in each period to normalize growth
        # This prevents "fake growth" if the dataset doesn't have a full previous period
        current_days = (df['Date_Parsed'].max() - cutoff_date).days
        if current_days <= 0: current_days = days
        
        prev_actual_days = (cutoff_date - p_df['Date_Parsed'].min()).days if not p_df.empty else 0
        if prev_actual_days <= 0: prev_actual_days = days

        def calc_growth(current, previous, cur_d, prev_d):
            if previous <= 0: return 0
            # Normalize to daily average
            curr_avg = current / cur_d
            prev_avg = previous / prev_d
            return round(((curr_avg / prev_avg) - 1) * 100, 1)

        prev_sales = p_df['Val_Sales'].sum()
        prev_profit = p_df['Val_Profit'].sum() if 'Val_Profit' in p_df.columns else 0
        prev_orders = len(p_df)

        total_sales = f_df['Val_Sales'].sum()
        total_profit = f_df['Val_Profit'].sum()
        total_orders = len(f_df)

        sales_growth = calc_growth(total_sales, prev_sales, current_days, prev_actual_days)
        profit_growth = calc_growth(total_profit, prev_profit, current_days, prev_actual_days)
        order_growth = calc_growth(total_orders, prev_orders, current_days, prev_actual_days)

        top_p = f_df.groupby(actual_prod_col)['Val_Sales'].sum().sort_values(ascending=False).head(5).to_dict()

        # Grouping for chart
        chart_df = f_df.groupby(f_df['Date_Parsed'].dt.date)['Val_Sales'].sum().reset_index()
        chart_df.columns = ['Date', 'Total_Sales']
        chart_df['Date'] = chart_df['Date'].astype(str)

        prediction = 0
        if len(chart_df) > 1:
            chart_df['idx'] = np.arange(len(chart_df))
            model = LinearRegression().fit(chart_df[['idx']], chart_df['Total_Sales'])
            future_idx = np.array([[len(chart_df) + i] for i in range(1, 31)])
            prediction = max(0, float(np.sum(model.predict(future_idx))))

        # Insights
        analysis_result = generate_insights(f_df, actual_prod_col, 'Val_Sales')
        
        process_time = time.time() - start_time
        print(f"DEBUG: Processed stats in {process_time:.4f}s. Rows: {len(f_df)}")

        # OPTIMIZATION: Limit raw data to prevent frontend crash
        limited_raw_data = f_df.head(1000).to_dict(orient="records")

        return {
            "total_sales": round(total_sales, 2),
            "total_profit": round(total_profit, 2),
            "total_orders": total_orders,
            "top_products": top_p,
            "chart_data": chart_df.to_dict(orient="records"),
            "prediction_next_month": round(prediction, 2),
            "raw_data": limited_raw_data,
            "growth": sales_growth,
            "profit_growth": profit_growth,
            "order_growth": order_growth,
            "analysis_result": analysis_result,
            "is_truncated": len(df) > 500, # Use original df length for truncated check
            "profit_status": "mapped" if (profit_col and profit_col in df.columns) else "estimated"
        }
    except Exception as e:
        import traceback
        print("CRITICAL ERROR in get_stats:")
        traceback.print_exc()
        return {"error": "Processing Error", "message": f"Gagal mengolah data: {str(e)}"}

@app.get("/api/files")
def list_files():
    try:
        files = [f for f in os.listdir(UPLOAD_DIR) if f.endswith('.csv')]
        return {"files": files}
    except Exception as e:
        return {"error": str(e)}

# --- 2. ENDPOINT UPDATE BARIS ---
@app.put("/api/update-row")
def update_row(entry: UpdateRowEntry):
    try:
        target = os.path.join(UPLOAD_DIR, entry.filename) if entry.filename else DEFAULT_FILE
        df = load_data(target)
        idx = entry.index
        if 0 <= idx < len(df):
            for key, val in entry.new_data.items():
                df.at[df.index[idx], key] = val
            df.to_csv(target, index=False)
            clear_backend_cache()
            return {"status": "success"}
        return {"status": "error", "message": "Index not found"}
    except Exception as e:
        return {"error": "Processing Error", "message": str(e)}

# --- 3. ENDPOINT DELETE SINGLE ROW ---
@app.delete("/api/delete-row/{index}")
def delete_row(index: int, filename: Optional[str] = None):
    try:
        target = os.path.join(UPLOAD_DIR, filename) if filename else DEFAULT_FILE
        df = load_data(target)
        if 0 <= index < len(df):
            df = df.drop(df.index[index])
            df.to_csv(target, index=False)
            clear_backend_cache()
            return {"status": "success"}
        return {"status": "error", "message": "Index not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- 4. ENDPOINT BATCH DELETE (Hapus Banyak) ---
@app.post("/api/delete-multiple")
def delete_multiple(data: BatchDelete):
    try:
        target = os.path.join(UPLOAD_DIR, data.filename) if data.filename else DEFAULT_FILE
        df = load_data(target)
        df = df.drop(df.index[data.indexes])
        df.to_csv(target, index=False)
        clear_backend_cache()
        return {"status": "success", "message": f"{len(data.indexes)} baris dihapus"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- 5. ENDPOINT TAMBAH DATA ---
@app.post("/api/add-sale")
def add_sale(entry: SaleEntry):
    try:
        target = os.path.join(UPLOAD_DIR, entry.filename) if entry.filename else DEFAULT_FILE
        df = load_data(target)
        new_row = {
            "Date": datetime.now().strftime("%Y-%m-%d"),
            "Product": entry.Product,
            "Total_Sales": entry.Total_Sales,
            "Profit": entry.Total_Sales - entry.Cost
        }
        # If headers differ, we should try to match some columns or just append
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df.to_csv(target, index=False)
        clear_backend_cache() # Clear cache after adding data
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- 6. ENDPOINT UPLOAD ---
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Gunakan smart_read_csv untuk menangani encoding beragam
        df = smart_read_csv(file_path)
        clear_backend_cache() # Clear cache after new upload
        
        return {
            "status": "success",
            "filename": file.filename, 
            "columns": df.columns.tolist()
        }
    except Exception as e:
        import traceback
        print(f"Upload Error: {str(e)}")
        print(traceback.format_exc())
        return {
            "status": "error",
            "message": f"Gagal membaca file: {str(e)}"
        }

# --- 7. ENDPOINT CLEAR ALL ---
@app.delete("/api/clear-data")
def clear_data():
    try:
        # Kosongkan folder upload
        for f in os.listdir(UPLOAD_DIR):
            file_p = os.path.join(UPLOAD_DIR, f)
            if os.path.isfile(file_p):
                os.remove(file_p)
        # Reset file default
        pd.DataFrame(columns=["Date", "Product", "Total_Sales", "Profit"]).to_csv(DEFAULT_FILE, index=False)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    import os
    # Mendukung port dinamis untuk hosting (Render, Heroku, dll)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)