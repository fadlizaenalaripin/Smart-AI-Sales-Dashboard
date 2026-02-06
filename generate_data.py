import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

def generate_business_data(rows=2000):
    np.random.seed(42)
    
    # List produk dummy
    products = {
        'Electronics': [('Laptop', 800, 1200), ('Smartphone', 400, 700), ('Headphones', 50, 150)],
        'Apparel': [('T-Shirt', 10, 25), ('Jeans', 30, 60), ('Hoodie', 40, 80)],
        'Home': [('Coffee Maker', 60, 120), ('Desk Lamp', 20, 45), ('Chair', 100, 250)]
    }

    data = []
    # Data dari 2 tahun lalu sampai hari ini
    end_date = datetime.now()
    start_date = end_date - timedelta(days=730)

    for i in range(rows):
        # Generate tanggal acak
        days_to_add = random.randint(0, 730)
        date = start_date + timedelta(days=days_to_add)
        
        category = random.choice(list(products.keys()))
        product_info = random.choice(products[category])
        
        product_name = product_info[0]
        cogs = product_info[1] # Modal
        price = product_info[2] # Harga jual
        
        # Tambahkan fluktuasi harga & promo (The "Real" Factor)
        price = price * random.uniform(0.85, 1.15)
        
        quantity = random.randint(1, 5)
        total_sales = price * quantity
        total_cogs = cogs * quantity
        profit = total_sales - total_cogs
        
        customer_id = f"CUST-{random.randint(100, 500)}"
        location = random.choice(['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Makassar'])

        data.append([date, customer_id, product_name, category, quantity, 
                     round(total_sales, 2), round(profit, 2), location])

    df = pd.DataFrame(data, columns=['Date', 'Customer_ID', 'Product', 'Category', 
                                     'Quantity', 'Total_Sales', 'Profit', 'Location'])
    
    # Sort berdasarkan tanggal
    df = df.sort_values(by='Date')
    df.to_csv('business_data.csv', index=False)
    print("✅ Sukses! File 'business_data.csv' berhasil dibuat.")

if __name__ == "__main__":
    generate_business_data()