<?php

namespace App\Http\Controllers\Api;

use App\Models\Book;
use App\Models\Checkout;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class BookController extends BaseController
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $books = Book::orderBy('name', 'asc')->with(['authors.phones', 'genre'])->get();

        foreach ($books as $book) {
            $book->file = $this->getS3Url($book->file);
        }

        return $this->sendResponse($books, 'Books');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required',
            'genre_id' => 'required',
            'description' => 'required',
            'file' => 'required|image|mimes:jpeg,png,jpg,gif,svg',
            'inventory_total_qty' => 'required|integer|min:1'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors());
        }

        $book = new Book;

        if ($request->hasFile('file')) {
            $extension = request()->file('file')->getClientOriginalExtension();
            $image_name = time() . '_book_cover.' . $extension;
            $path = $request->file('file')->storeAs(
                'images',
                $image_name,
                's3'
            );
            Storage::disk('s3')->setVisibility($path, "public");
            if (!$path) {
                return $this->sendError($path, 'Book cover failed to upload!');
            }

            $book->file = $path;
        }

        $book->name = $request['name'];
        $book->description = $request['description'];
        $book->checked_qty = 0;
        $book->genre_id = $request['genre_id'];
        $book->inventory_total_qty = $request['inventory_total_qty'];

        $book->save();

        if (isset($book->file)) {
            $book->file = $this->getS3Url($book->file);
        }
        $success['book'] = $book;
        return $this->sendResponse($success, 'Book succesfully updated!');
    }

    public function updateBookPicture(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|image|mimes:jpeg,png,jpg,gif,svg'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors());
        }

        $book = Book::findOrFail($id);

        if ($request->hasFile('file')) {
            $extension = request()->file('file')->getClientOriginalExtension();
            $image_name = time() . '_book_cover.' . $extension;
            $path = $request->file('file')->storeAs(
                'images',
                $image_name,
                's3'
            );
            Storage::disk('s3')->setVisibility($path, "public");
            if (!$path) {
                return $this->sendError($path, 'Book cover failed to upload!');
            }

            $book->file = $path;
        }
        $book->save();

        if (isset($book->file)) {
            $book->file = $this->getS3Url($book->file);
        }
        $success['book'] = $book;
        return $this->sendResponse($success, 'Book picture successfully updated!');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required',
            'description' => 'required',
            'genre_id' => 'required',
            'inventory_total_qty' => 'required|integer|min:1|gte:checked_qty'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors());
        }

        $book = Book::findOrFail($id);
        $book->name = $request['name'];
        $book->description = $request['description'];
        $book->genre_id = $request['genre_id'];
        $book->inventory_total_qty = $request['inventory_total_qty'];
        $book->save();

        if (isset($book->file)) {
            $book->file = $this->getS3Url($book->file);
        }
        $success['book'] = $book;
        return $this->sendResponse($success, 'Book succesfully updated!');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $book = Book::findOrFail($id);
        Storage::disk('s3')->delete($book->file);
        $book->delete();

        $success['book']['id'] = $id;
        return $this->sendResponse($success, 'Book Deleted');
    }

    public function checkoutBook(Request $request, $id)
    {
        $request['checkout_date'] = date('Y-m-d');
        $validator = Validator::make($request->all(), [
            'checkout_date' => 'required',
            'due_date' => 'required|date_format:Y-m-d|after_or_equal:checkout_date'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors());
        }

        $book = Book::findOrFail($id);
        $book->checked_qty = $book->checked_qty + 1;

        if ($book->checked_qty > $book->inventory_total_qty) {
            return $this->sendError('Checkout Out Book Can Not Exceed Inventory!');
        }

        $checkoutId = Checkout::insertGetId([
            'checkout_date' => $request['checkout_date'],
            'due_date' => $request['due_date']
        ]);

        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        DB::table('user_book_checkouts')->insert([
            'user_id' => $user->id,
            'book_id' => $book->id,
            'checkout_id' => $checkoutId
        ]);

        $book->save();

        $book = Book::findOrFail($id)->load(['checkouts' => function ($query) {
            $query->whereNull('checkin_date');
        }]);
        $success['book'] = $book;
        return $this->sendResponse($success, 'Book Checkedout');
    }

    public function sendBookReport()
    {
        try {
            $authUser = Auth::user();
            $email = $authUser->email;
            
            Log::info('Sending book report', ['email' => $email]);
            
            // Call the books report command (sends list of Harry Potter books)
            $exitCode = \Illuminate\Support\Facades\Artisan::call('report:books', ['--email' => $email]);
            $output = \Illuminate\Support\Facades\Artisan::output();
            
            Log::info('Book report command executed', ['exit_code' => $exitCode, 'output' => $output]);
            
            if ($exitCode !== 0) {
                Log::error('Book report command failed with exit code: ' . $exitCode);
                return $this->sendError('Failed to send book report', [], 500);
            }
            
            $success['success'] = true;
            return $this->sendResponse($success, 'Book Report Sent!');
        } catch (\Exception $e) {
            Log::error('Book report failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->sendError('Failed to send book report: ' . $e->getMessage(), [], 500);
        }
    }

    public function returnBook($id)
    {
        $book = Book::findOrFail($id);
        
        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        
        // Find an active checkout (where checkin_date is null) for this user and book
        $userBookCheckout = DB::table('user_book_checkouts')
            ->join('checkouts', 'user_book_checkouts.checkout_id', '=', 'checkouts.id')
            ->where('user_book_checkouts.user_id', $user->id)
            ->where('user_book_checkouts.book_id', $book->id)
            ->whereNull('checkouts.checkin_date')
            ->select('user_book_checkouts.checkout_id')
            ->first();

        if (!$userBookCheckout) {
            return $this->sendError('No active checkout found for this book', [], 404);
        }

        $checkoutID = $userBookCheckout->checkout_id;

        DB::table('checkouts')->where('id', $checkoutID)->update([
            'checkin_date' => date('Y-m-d')
        ]);

        $book->checked_qty = $book->checked_qty - 1;

        if ($book->checked_qty < 0) {
            $book->checked_qty = 0;
        }

        $book->save();

        $book = Book::findOrFail($id)->load(['checkouts' => function ($query) {
            $query->whereNull('checkin_date');
        }]);
        $success['book'] = $book;
        return $this->sendResponse($success, 'Book Returned');
    }
}

